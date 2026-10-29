// TalentFlow Evaluation Fixtures
// Provides deterministic test scenarios for anomaly detection evaluation:
// 1. Withdrawn candidate with active scheduled interview
// 2. Scorecard containing irrelevant criterion ("Cooking skills") for Frontend Engineer
// 3. Genuinely overlapping scheduled interviews sharing an interviewer
import { PrismaClient, CandidateSource } from '@prisma/client'

export async function seedEvaluationFixtures(prisma: PrismaClient) {
  // Find or pick requisition and interviewers
  const req = await prisma.requisition.findFirst({
    where: { title: 'Frontend Engineer' },
  }) || await prisma.requisition.findFirst()

  if (!req) {
    throw new Error('Base requisition not found for evaluation fixtures.')
  }

  const interviewer = await prisma.interviewer.findFirst({
    include: { user: true },
  })

  if (!interviewer) {
    throw new Error('Base interviewer not found for evaluation fixtures.')
  }

  const panel = await prisma.interviewPanel.findFirst({
    where: { members: { some: { interviewerId: interviewer.id } } },
  }) || await prisma.interviewPanel.findFirst()

  if (!panel) {
    throw new Error('Base interview panel not found for evaluation fixtures.')
  }

  // ─── Fixture 1: Withdrawn Candidate Still Scheduled ─────────────────────────
  let cand1 = await prisma.candidate.findUnique({
    where: { email: 'tariq.vance.eval@example.test' },
  })
  if (!cand1) {
    cand1 = await prisma.candidate.create({
      data: {
        businessId: 'CAND-EVAL-000001',
        name: 'Tariq Vance',
        email: 'tariq.vance.eval@example.test',
        location: 'Remote',
        source: CandidateSource.Referral,
        experienceYears: 4,
        skills: ['React', 'TypeScript'],
      },
    })
  }

  let app1 = await prisma.application.findUnique({
    where: { candidateId_requisitionId: { candidateId: cand1.id, requisitionId: req.id } },
  })
  if (!app1) {
    app1 = await prisma.application.create({
      data: {
        businessId: 'APP-EVAL-000001',
        candidateId: cand1.id,
        requisitionId: req.id,
        stage: 'Withdrawn',
        source: CandidateSource.Referral,
      },
    })
  } else if (app1.stage !== 'Withdrawn') {
    app1 = await prisma.application.update({
      where: { id: app1.id },
      data: { stage: 'Withdrawn' },
    })
  }

  let intv1 = await prisma.interview.findUnique({
    where: { businessId: 'INT-EVAL-000001' },
  })
  if (!intv1) {
    const startAt = new Date(Date.now() + 24 * 3600 * 1000)
    const endAt = new Date(startAt.getTime() + 60 * 60000)
    intv1 = await prisma.interview.create({
      data: {
        businessId: 'INT-EVAL-000001',
        applicationId: app1.id,
        panelId: panel.id,
        title: 'Frontend Technical Loop',
        startAt,
        endAt,
        status: 'Scheduled',
        interviewers: {
          create: [{ interviewerId: interviewer.id }],
        },
      },
    })
  }

  // ─── Fixture 2: Irrelevant Scorecard Criterion ──────────────────────────────
  let cookingCriterion = await prisma.rubricCriterion.findUnique({
    where: { key: 'cooking_skills' },
  })
  if (!cookingCriterion) {
    cookingCriterion = await prisma.rubricCriterion.create({
      data: {
        key: 'cooking_skills',
        label: 'Cooking skills',
        hint: 'Culinary and culinary arts capability unrelated to software engineering',
        applicableStages: ['Interview'],
      },
    })
  }

  let technicalCriterion = await prisma.rubricCriterion.findUnique({
    where: { key: 'technical' },
  })

  let cand2 = await prisma.candidate.findUnique({
    where: { email: 'elena.rostova.eval@example.test' },
  })
  if (!cand2) {
    cand2 = await prisma.candidate.create({
      data: {
        businessId: 'CAND-EVAL-000002',
        name: 'Elena Rostova',
        email: 'elena.rostova.eval@example.test',
        location: 'Berlin',
        source: CandidateSource.CareerssSite,
        experienceYears: 5,
        skills: ['React', 'CSS'],
      },
    })
  }

  let app2 = await prisma.application.findUnique({
    where: { candidateId_requisitionId: { candidateId: cand2.id, requisitionId: req.id } },
  })
  if (!app2) {
    app2 = await prisma.application.create({
      data: {
        businessId: 'APP-EVAL-000002',
        candidateId: cand2.id,
        requisitionId: req.id,
        stage: 'Interview',
        source: CandidateSource.CareerssSite,
      },
    })
  }

  let intv2 = await prisma.interview.findUnique({
    where: { businessId: 'INT-EVAL-000002' },
  })
  if (!intv2) {
    const startAt = new Date(Date.now() - 3 * 24 * 3600 * 1000)
    const endAt = new Date(startAt.getTime() + 60 * 60000)
    intv2 = await prisma.interview.create({
      data: {
        businessId: 'INT-EVAL-000002',
        applicationId: app2.id,
        panelId: panel.id,
        title: 'Frontend Component Deep Dive',
        startAt,
        endAt,
        status: 'Completed',
        interviewers: {
          create: [{ interviewerId: interviewer.id }],
        },
      },
    })
  }

  let sc2 = await prisma.scorecard.findUnique({
    where: { businessId: 'SCORE-EVAL-000001' },
  })
  if (!sc2) {
    sc2 = await prisma.scorecard.create({
      data: {
        businessId: 'SCORE-EVAL-000001',
        interviewId: intv2.id,
        interviewerId: interviewer.id,
        applicationId: app2.id,
        recommendation: 'Yes',
        notes: 'Elena demonstrated strong React knowledge, but was also evaluated on culinary abilities.',
        ratings: {
          create: [
            ...(technicalCriterion ? [{ criterionId: technicalCriterion.id, rating: 4 }] : []),
            { criterionId: cookingCriterion.id, rating: 3 },
          ],
        },
      },
    })
  }

  // ─── Fixture 3: Genuinely Overlapping Interviews ────────────────────────────
  let cand3 = await prisma.candidate.findUnique({
    where: { email: 'marcus.vance.eval@example.test' },
  })
  if (!cand3) {
    cand3 = await prisma.candidate.create({
      data: {
        businessId: 'CAND-EVAL-000003',
        name: 'Marcus Vance',
        email: 'marcus.vance.eval@example.test',
        location: 'London',
        source: CandidateSource.JobBoard,
        experienceYears: 6,
        skills: ['TypeScript'],
      },
    })
  }

  let app3 = await prisma.application.findUnique({
    where: { candidateId_requisitionId: { candidateId: cand3.id, requisitionId: req.id } },
  })
  if (!app3) {
    app3 = await prisma.application.create({
      data: {
        businessId: 'APP-EVAL-000003',
        candidateId: cand3.id,
        requisitionId: req.id,
        stage: 'Interview',
        source: CandidateSource.JobBoard,
      },
    })
  }

  let cand4 = await prisma.candidate.findUnique({
    where: { email: 'nadia.patel.eval@example.test' },
  })
  if (!cand4) {
    cand4 = await prisma.candidate.create({
      data: {
        businessId: 'CAND-EVAL-000004',
        name: 'Nadia Patel',
        email: 'nadia.patel.eval@example.test',
        location: 'Remote',
        source: CandidateSource.Campus,
        experienceYears: 3,
        skills: ['React'],
      },
    })
  }

  let app4 = await prisma.application.findUnique({
    where: { candidateId_requisitionId: { candidateId: cand4.id, requisitionId: req.id } },
  })
  if (!app4) {
    app4 = await prisma.application.create({
      data: {
        businessId: 'APP-EVAL-000004',
        candidateId: cand4.id,
        requisitionId: req.id,
        stage: 'Interview',
        source: CandidateSource.Campus,
      },
    })
  }

  // Interview A: 14:00 - 15:00
  let intv3 = await prisma.interview.findUnique({
    where: { businessId: 'INT-EVAL-000003' },
  })
  if (!intv3) {
    const startA = new Date('2026-11-05T14:00:00.000Z')
    const endA = new Date('2026-11-05T15:00:00.000Z')
    intv3 = await prisma.interview.create({
      data: {
        businessId: 'INT-EVAL-000003',
        applicationId: app3.id,
        panelId: panel.id,
        title: 'System Architecture Evaluation A',
        startAt: startA,
        endAt: endA,
        status: 'Scheduled',
        interviewers: {
          create: [{ interviewerId: interviewer.id }],
        },
      },
    })
  }

  // Interview B: 14:30 - 15:30 (overlaps with Interview A by 30 mins)
  let intv4 = await prisma.interview.findUnique({
    where: { businessId: 'INT-EVAL-000004' },
  })
  if (!intv4) {
    const startB = new Date('2026-11-05T14:30:00.000Z')
    const endB = new Date('2026-11-05T15:30:00.000Z')
    intv4 = await prisma.interview.create({
      data: {
        businessId: 'INT-EVAL-000004',
        applicationId: app4.id,
        panelId: panel.id,
        title: 'System Architecture Evaluation B',
        startAt: startB,
        endAt: endB,
        status: 'Scheduled',
        interviewers: {
          create: [{ interviewerId: interviewer.id }],
        },
      },
    })
  }

  // ─── Fixture 4: Out of Band Offer ──────────────────────────────────────────
  let outOfBandOffer: any = await prisma.offer.findFirst({
    where: { businessId: 'OFF-2026-000001' },
    include: { application: { include: { requisition: true } } },
  })
  if (outOfBandOffer) {
    const maxBand = Number(outOfBandOffer.application?.requisition?.bandMax ?? outOfBandOffer.bandMax)
    if (Number(outOfBandOffer.base) <= maxBand) {
      await prisma.offer.update({
        where: { id: outOfBandOffer.id },
        data: {
          base: maxBand + 10000,
          outOfBand: true,
        },
      })
    }
  } else {
    const offerApp = await prisma.application.findFirst({
      include: { requisition: true },
    })
    if (offerApp) {
      const maxBand = Number(offerApp.requisition.bandMax)
      outOfBandOffer = await prisma.offer.create({
        data: {
          businessId: 'OFF-2026-000001',
          applicationId: offerApp.id,
          base: maxBand + 10000,
          bonusPct: 15,
          bandMin: offerApp.requisition.bandMin,
          bandMax: offerApp.requisition.bandMax,
          status: 'PendingApproval',
          outOfBand: true,
        },
      })
    }
  }

  // ─── Fixture 5: Missing Review Completed Interview ─────────────────────────
  let missingReviewIntv = await prisma.interview.findFirst({
    where: { status: 'Completed', businessId: 'INT-2026-000002' },
  })
  if (!missingReviewIntv) {
    const app = await prisma.application.findFirst()
    if (app) {
      missingReviewIntv = await prisma.interview.create({
        data: {
          businessId: 'INT-2026-000002',
          applicationId: app.id,
          panelId: panel.id,
          title: 'Backend Engineering Loop',
          startAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
          endAt: new Date(Date.now() - 3 * 24 * 3600 * 1000 + 3600000),
          status: 'Completed',
          interviewers: {
            create: [{ interviewerId: interviewer.id }],
          },
        },
      })
    }
  }

  return {
    withdrawnInterview: intv1.businessId,
    irrelevantScorecard: sc2.businessId,
    overlappingInterviews: [intv3.businessId, intv4.businessId],
  }
}
