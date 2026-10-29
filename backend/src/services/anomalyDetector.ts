// TalentFlow Anomaly Detection Service
// Scans recruitment operations data in PostgreSQL for business rule violations
import { PrismaClient } from '@prisma/client'

export interface DetectedAnomaly {
  checkName: string
  issueType: string
  severity: 'Low' | 'Medium' | 'High'
  affectedRecordId: string
  expectedDecision: string
  detail: string
}

export const STANDARD_RUBRIC_KEYS = new Set([
  'technical',
  'problem',
  'communication',
  'collaboration',
  'values',
])

/**
 * Pure evaluation function: scans current database entities and returns list of anomaly records
 */
export async function evaluateAnomalies(prisma: PrismaClient): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = []

  // ─── 1. Missing Review ──────────────────────────────────────────────────────
  // Completed interview where an assigned interviewer has not submitted a scorecard
  const completedInterviews = await prisma.interview.findMany({
    where: { status: 'Completed' },
    include: {
      interviewers: { include: { interviewer: { include: { user: true } } } },
      scorecards: true,
    },
  })

  for (const intv of completedInterviews) {
    for (const ivr of intv.interviewers) {
      const hasScorecard = intv.scorecards.some((sc) => sc.interviewerId === ivr.interviewerId)
      if (!hasScorecard) {
        anomalies.push({
          checkName: 'missing_review',
          issueType: 'MissingReview',
          severity: 'Medium',
          affectedRecordId: intv.businessId,
          expectedDecision: 'Submit missing scorecard review',
          detail: `Interview ${intv.businessId} completed without submitted scorecard from ${ivr.interviewer.user.name}.`,
        })
      }
    }
  }

  // ─── 2. Interviewer Double-Booked ───────────────────────────────────────────
  // Overlapping scheduled/rescheduled interviews for the same panel interviewer
  const activeInterviews = await prisma.interview.findMany({
    where: { status: { in: ['Scheduled', 'Rescheduled'] } },
    include: {
      interviewers: { include: { interviewer: { include: { user: true } } } },
    },
    orderBy: { startAt: 'asc' },
  })

  for (let i = 0; i < activeInterviews.length; i++) {
    const i1 = activeInterviews[i]
    for (let j = i + 1; j < activeInterviews.length; j++) {
      const i2 = activeInterviews[j]
      const overlaps = i1.startAt < i2.endAt && i1.endAt > i2.startAt
      if (!overlaps) continue

      const commonIvr = i1.interviewers.find((ivr1) =>
        i2.interviewers.some((ivr2) => ivr2.interviewerId === ivr1.interviewerId),
      )

      if (commonIvr) {
        const ivrName = commonIvr.interviewer.user.name
        const pairId = [i1.businessId, i2.businessId].sort().join(', ')
        anomalies.push({
          checkName: 'interviewer_availability',
          issueType: 'InterviewerDoubleBooked',
          severity: 'High',
          affectedRecordId: pairId,
          expectedDecision: 'Reschedule interview',
          detail: `Interviewer ${ivrName} double-booked on ${i1.businessId} and ${i2.businessId} (${i1.startAt.toISOString()} - ${i1.endAt.toISOString()}).`,
        })
      }
    }
  }

  // ─── 3. Offer Exceeds Band ──────────────────────────────────────────────────
  // Offer base compensation exceeds the requisition salary band maximum
  const offers = await prisma.offer.findMany({
    include: {
      application: {
        include: {
          requisition: true,
        },
      },
    },
  })

  for (const offer of offers) {
    const base = Number(offer.base)
    const bandMax = Number(offer.application?.requisition?.bandMax ?? offer.bandMax)
    if (base > bandMax) {
      anomalies.push({
        checkName: 'offer_band_check',
        issueType: 'OfferExceedsBand',
        severity: 'Medium',
        affectedRecordId: offer.businessId,
        expectedDecision: 'Request comp review',
        detail: `Offer ${offer.businessId} base salary ($${base.toLocaleString()}) exceeds requisition ${offer.application.requisition.businessId} maximum band ($${bandMax.toLocaleString()}).`,
      })
    }
  }

  // ─── 4. Withdrawn Candidate Still Scheduled ─────────────────────────────────
  // Candidate's application is Withdrawn but has an active scheduled interview
  const withdrawnInterviews = await prisma.interview.findMany({
    where: {
      status: { in: ['Scheduled', 'Rescheduled'] },
      application: { stage: 'Withdrawn' },
    },
    include: {
      application: {
        include: { candidate: true },
      },
    },
  })

  for (const intv of withdrawnInterviews) {
    anomalies.push({
      checkName: 'withdrawn_candidate_scheduled',
      issueType: 'WithdrawnCandidateStillScheduled',
      severity: 'High',
      affectedRecordId: intv.businessId,
      expectedDecision: 'Cancel interview',
      detail: `Candidate ${intv.application.candidate.name} withdrew application ${intv.application.businessId}, but interview ${intv.businessId} remains scheduled.`,
    })
  }

  // ─── 5. Irrelevant Scorecard Criterion ──────────────────────────────────────
  // Scorecard includes criteria not in the standard/approved role rubric
  const scorecards = await prisma.scorecard.findMany({
    include: {
      ratings: {
        include: { criterion: true },
      },
      application: {
        include: { candidate: true, requisition: true },
      },
    },
  })

  for (const sc of scorecards) {
    const invalidRatings = sc.ratings.filter(
      (r) => !STANDARD_RUBRIC_KEYS.has(r.criterion.key),
    )
    if (invalidRatings.length > 0) {
      const invalidLabels = invalidRatings
        .map((r) => r.criterion.label || r.criterion.key)
        .join(', ')
      anomalies.push({
        checkName: 'irrelevant_scorecard_criterion',
        issueType: 'IrrelevantScorecardCriterion',
        severity: 'Medium',
        affectedRecordId: sc.businessId,
        expectedDecision: 'Remove unapproved criterion',
        detail: `Scorecard ${sc.businessId} contains irrelevant criterion: ${invalidLabels}.`,
      })
    }
  }

  return anomalies
}

/**
 * Synchronizes detected anomalies to the PostgreSQL validation_results table.
 * Preserves user-modified statuses (e.g. Investigating, Resolved) and avoids duplicate rows.
 */
export async function runAnomalyDetection(prisma: PrismaClient) {
  const detected = await evaluateAnomalies(prisma)

  let genRun = await prisma.generationRun.findFirst({
    orderBy: { createdAt: 'desc' },
  })

  if (!genRun) {
    genRun = await prisma.generationRun.create({
      data: {
        businessId: 'GEN-000001',
        seed: BigInt(20261022),
        profile: 'starter',
        generatorVersion: '1.0.0',
        status: 'Completed',
      },
    })
  }

  const results = []

  for (const item of detected) {
    // Truncate expectedDecision to 50 characters max just in case
    const safeExpectedDecision = item.expectedDecision.slice(0, 50)
    const safeAffectedRecordId = item.affectedRecordId.slice(0, 100)
    const safeCheckName = item.checkName.slice(0, 100)
    const safeIssueType = item.issueType.slice(0, 100)

    const existing = await prisma.validationResult.findFirst({
      where: {
        issueType: safeIssueType,
        affectedRecordId: safeAffectedRecordId,
      },
    })

    if (existing) {
      // Idempotent update: preserve status (Open / Investigating / Resolved)
      const updated = await prisma.validationResult.update({
        where: { id: existing.id },
        data: {
          detected: true,
          isAnomaly: true,
          checkName: safeCheckName,
          expectedDecision: safeExpectedDecision,
        },
      })
      results.push(updated)
    } else {
      // Create new open anomaly
      const created = await prisma.validationResult.create({
        data: {
          generationRunId: genRun.id,
          checkName: safeCheckName,
          issueType: safeIssueType,
          severity: item.severity,
          status: 'Open',
          isAnomaly: true,
          detected: true,
          affectedRecordId: safeAffectedRecordId,
          expectedDecision: safeExpectedDecision,
        },
      })
      results.push(created)
    }
  }

  return {
    evaluatedCount: detected.length,
    anomalies: results,
  }
}
