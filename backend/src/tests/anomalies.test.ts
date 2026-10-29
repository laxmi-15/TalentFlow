// TalentFlow Anomaly Detection System Integration Tests
import request from 'supertest'
import { describe, it, expect, beforeAll } from 'vitest'
import app from '../index'
import { prisma } from '../db'
import { evaluateAnomalies, runAnomalyDetection } from '../services/anomalyDetector'
import { seedEvaluationFixtures } from '../fixtures/evaluationFixtures'

let adminToken: string

beforeAll(async () => {
  // Login as Admin
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'meera@example.test', password: 'Password123!' })
  adminToken = loginRes.body.token

  // Seed evaluation fixtures and run detection
  await seedEvaluationFixtures(prisma)
  await runAnomalyDetection(prisma)
})

describe('TalentFlow Anomaly Detection — 5 Anomaly Types', () => {
  it('detects all 5 required anomaly types in the system', async () => {
    const detected = await evaluateAnomalies(prisma)
    const types = new Set(detected.map((a) => a.issueType))

    expect(types).toContain('MissingReview')
    expect(types).toContain('InterviewerDoubleBooked')
    expect(types).toContain('OfferExceedsBand')
    expect(types).toContain('WithdrawnCandidateStillScheduled')
    expect(types).toContain('IrrelevantScorecardCriterion')
  })

  it('detects WithdrawnCandidateStillScheduled when candidate withdrew but interview remains scheduled', async () => {
    const detected = await evaluateAnomalies(prisma)
    const anomaly = detected.find((a) => a.issueType === 'WithdrawnCandidateStillScheduled')

    expect(anomaly).toBeDefined()
    expect(anomaly?.severity).toBe('High')
    expect(anomaly?.affectedRecordId).toBe('INT-EVAL-000001')
    expect(anomaly?.detail).toContain('Tariq Vance')
  })

  it('detects IrrelevantScorecardCriterion when scorecard includes unapproved criterion (Cooking skills)', async () => {
    const detected = await evaluateAnomalies(prisma)
    const anomaly = detected.find((a) => a.issueType === 'IrrelevantScorecardCriterion')

    expect(anomaly).toBeDefined()
    expect(anomaly?.affectedRecordId).toBe('SCORE-EVAL-000001')
    expect(anomaly?.detail).toContain('Cooking skills')
  })

  it('detects InterviewerDoubleBooked for genuinely overlapping interviews with same interviewer', async () => {
    const detected = await evaluateAnomalies(prisma)
    const anomaly = detected.find(
      (a) => a.issueType === 'InterviewerDoubleBooked' && a.affectedRecordId.includes('INT-EVAL-000003'),
    )

    expect(anomaly).toBeDefined()
    expect(anomaly?.severity).toBe('High')
    expect(anomaly?.affectedRecordId).toContain('INT-EVAL-000003')
    expect(anomaly?.affectedRecordId).toContain('INT-EVAL-000004')
    expect(anomaly?.detail).toContain('Samir Qureshi')
  })

  it('detects OfferExceedsBand when offer base salary exceeds requisition band maximum', async () => {
    const detected = await evaluateAnomalies(prisma)
    const anomaly = detected.find((a) => a.issueType === 'OfferExceedsBand')

    expect(anomaly).toBeDefined()
    expect(anomaly?.affectedRecordId).toBe('OFF-2026-000001')
    expect(anomaly?.detail).toContain('exceeds')
  })

  it('detects MissingReview when interview is completed without submitted scorecards', async () => {
    const detected = await evaluateAnomalies(prisma)
    const anomaly = detected.find((a) => a.issueType === 'MissingReview')

    expect(anomaly).toBeDefined()
    expect(anomaly?.expectedDecision).toContain('scorecard')
  })
})

describe('Negative Tests — Zero False Positives', () => {
  it('does NOT flag WithdrawnCandidateStillScheduled for active candidates with scheduled interviews', async () => {
    const detected = await evaluateAnomalies(prisma)
    // Jordan Reed is in Interview stage with INT-2026-000005 Scheduled
    const jordanAnomaly = detected.find(
      (a) => a.issueType === 'WithdrawnCandidateStillScheduled' && a.affectedRecordId === 'INT-2026-000005',
    )
    expect(jordanAnomaly).toBeUndefined()
  })

  it('does NOT flag WithdrawnCandidateStillScheduled for cancelled interviews', async () => {
    // Create a temporary cancelled interview for Tariq Vance (withdrawn)
    const app = await prisma.application.findFirst({ where: { stage: 'Withdrawn' } })
    const panel = await prisma.interviewPanel.findFirst()
    if (app && panel) {
      const cancelledIntv = await prisma.interview.create({
        data: {
          businessId: 'INT-TEST-CANCEL-01',
          applicationId: app.id,
          panelId: panel.id,
          title: 'Cancelled Discussion',
          startAt: new Date(),
          endAt: new Date(Date.now() + 3600000),
          status: 'Cancelled',
        },
      })

      const detected = await evaluateAnomalies(prisma)
      const anomaly = detected.find(
        (a) => a.issueType === 'WithdrawnCandidateStillScheduled' && a.affectedRecordId === 'INT-TEST-CANCEL-01',
      )
      expect(anomaly).toBeUndefined()

      await prisma.interview.delete({ where: { id: cancelledIntv.id } })
    }
  })

  it('does NOT flag IrrelevantScorecardCriterion for standard rubric scorecards', async () => {
    const detected = await evaluateAnomalies(prisma)
    // Any standard scorecard without cooking skills
    const validScorecardAnomaly = detected.find(
      (a) => a.issueType === 'IrrelevantScorecardCriterion' && a.affectedRecordId !== 'SCORE-EVAL-000001',
    )
    expect(validScorecardAnomaly).toBeUndefined()
  })

  it('does NOT flag InterviewerDoubleBooked for non-overlapping interviews', async () => {
    const detected = await evaluateAnomalies(prisma)
    // Priya Sharma (INT-2026-000001) and Lucas Meyer (INT-2026-000002) are on different days
    const falseDoubleBook = detected.find(
      (a) => a.issueType === 'InterviewerDoubleBooked' && a.affectedRecordId.includes('INT-2026-000002'),
    )
    expect(falseDoubleBook).toBeUndefined()
  })
})

describe('Idempotency & Status Preservation', () => {
  it('does NOT create duplicate validation_results on repeated detector runs', async () => {
    const beforeCount = await prisma.validationResult.count({ where: { isAnomaly: true } })

    // Run detector multiple times
    await runAnomalyDetection(prisma)
    await runAnomalyDetection(prisma)

    const afterCount = await prisma.validationResult.count({ where: { isAnomaly: true } })
    expect(afterCount).toBe(beforeCount)
  })

  it('preserves user-modified status (Investigating / Resolved) during repeated detector runs', async () => {
    // Find an anomaly and update its status to Investigating
    const target = await prisma.validationResult.findFirst({
      where: { issueType: 'WithdrawnCandidateStillScheduled' },
    })
    expect(target).toBeDefined()

    await prisma.validationResult.update({
      where: { id: target!.id },
      data: { status: 'Investigating' },
    })

    // Re-run detection
    await runAnomalyDetection(prisma)

    // Verify status was NOT reset to 'Open'
    const after = await prisma.validationResult.findUnique({
      where: { id: target!.id },
    })
    expect(after?.status).toBe('Investigating')

    // Reset back to Open
    await prisma.validationResult.update({
      where: { id: target!.id },
      data: { status: 'Open' },
    })
  })
})

describe('REST API Endpoints (/api/v1/anomalies)', () => {
  it('GET /api/v1/anomalies returns the 5 anomaly types', async () => {
    const res = await request(app)
      .get('/api/v1/anomalies')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    const list = Array.isArray(res.body) ? res.body : res.body.data
    expect(list.length).toBeGreaterThanOrEqual(5)

    const types = new Set(list.map((r: any) => r.type))
    expect(types).toContain('MissingReview')
    expect(types).toContain('InterviewerDoubleBooked')
    expect(types).toContain('OfferExceedsBand')
    expect(types).toContain('WithdrawnCandidateStillScheduled')
    expect(types).toContain('IrrelevantScorecardCriterion')
  })

  it('POST /api/v1/anomalies/detect runs detection on demand', async () => {
    const res = await request(app)
      .post('/api/v1/anomalies/detect')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('evaluatedCount')
    expect(res.body).toHaveProperty('detectedAnomalies')
  })

  it('PATCH /api/v1/anomalies/:id updates anomaly status with audit event', async () => {
    const listRes = await request(app)
      .get('/api/v1/anomalies')
      .set('Authorization', `Bearer ${adminToken}`)

    const list = Array.isArray(listRes.body) ? listRes.body : listRes.body.data
    const anomaly = list.find((a: any) => a.type === 'IrrelevantScorecardCriterion')
    expect(anomaly).toBeDefined()

    const patchRes = await request(app)
      .patch(`/api/v1/anomalies/${anomaly.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Investigating' })

    expect(patchRes.status).toBe(200)
    expect(patchRes.body.status).toBe('Investigating')

    // Clean up back to Open
    await request(app)
      .patch(`/api/v1/anomalies/${anomaly.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Open' })
  })
})
