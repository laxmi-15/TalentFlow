// TalentFlow Pipeline & Scorecard Integration Tests
import request from 'supertest'
import { describe, it, expect, beforeAll } from 'vitest'
import app from '../index'
import { prisma } from '../db'

let adminToken: string
let interviewerToken: string

beforeAll(async () => {
  // Login as Admin (try both test passwords)
  let adminRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'meera@example.test', password: 'TalentFlow2026!' })
  if (adminRes.status !== 200) {
    adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'meera@example.test', password: 'Password123!' })
  }
  adminToken = adminRes.body.token

  // Ensure Requisition, Interviewer, and Panel exist
  const req = await prisma.requisition.findFirst({ where: { status: 'Open' } })
  const panel = await prisma.interviewPanel.findFirst()
  const interviewerUser = await prisma.user.findFirst({
    where: { email: 'samir@example.test' },
    include: { interviewer: true },
  })
  const criteria = await prisma.rubricCriterion.findMany()
  const criteriaMap = Object.fromEntries(criteria.map((c) => [c.key, c.id]))

  // Seed / Upsert John Doe
  const john = await prisma.candidate.upsert({
    where: { email: 'john.doe@example.test' },
    update: { name: 'John Doe', location: 'Austin', skills: ['React', 'TypeScript', 'Node.js'] },
    create: {
      businessId: 'CAND-000015',
      name: 'John Doe',
      email: 'john.doe@example.test',
      phone: '+1 555 019 9234',
      location: 'Austin',
      source: 'Referral',
      experienceYears: 6,
      skills: ['React', 'TypeScript', 'Node.js', 'GraphQL'],
    },
  })

  let johnApp = await prisma.application.findFirst({
    where: { candidateId: john.id, requisitionId: req!.id },
  })
  if (!johnApp) {
    johnApp = await prisma.application.create({
      data: {
        businessId: `APP-${john.businessId}-${req!.businessId}`,
        candidateId: john.id,
        requisitionId: req!.id,
        stage: 'Final',
        score: 4.4,
        source: 'Referral',
      },
    })
  } else {
    johnApp = await prisma.application.update({
      where: { id: johnApp.id },
      data: { score: 4.4, stage: 'Final' },
    })
  }

  let johnInterview = await prisma.interview.findFirst({
    where: { applicationId: johnApp.id },
  })
  if (!johnInterview) {
    johnInterview = await prisma.interview.create({
      data: {
        businessId: 'INT-2026-000006',
        applicationId: johnApp.id,
        panelId: panel!.id,
        title: 'Technical & Architecture Interview - John Doe',
        startAt: new Date(Date.now() - 3600000 * 24),
        endAt: new Date(Date.now() - 3600000 * 23),
        status: 'Completed',
        interviewers: {
          create: { interviewerId: interviewerUser!.interviewer!.id },
        },
      },
    })
  }

  const existingJohnScorecard = await prisma.scorecard.findFirst({
    where: { applicationId: johnApp.id },
  })
  if (!existingJohnScorecard) {
    await prisma.scorecard.create({
      data: {
        businessId: `SCORE-${johnInterview.businessId}-${interviewerUser!.businessId}`,
        interviewId: johnInterview.id,
        interviewerId: interviewerUser!.interviewer!.id,
        applicationId: johnApp.id,
        recommendation: 'StrongYes',
        notes: 'Outstanding technical depth, excellent React and TypeScript design patterns.',
        ratings: {
          create: [
            { criterionId: criteriaMap['technical'], rating: 5 },
            { criterionId: criteriaMap['problem'], rating: 4 },
            { criterionId: criteriaMap['communication'], rating: 4 },
            { criterionId: criteriaMap['collaboration'], rating: 5 },
            { criterionId: criteriaMap['values'], rating: 4 },
          ],
        },
      },
    })
  }

  // Seed / Upsert Jordan Reed
  const jordan = await prisma.candidate.upsert({
    where: { email: 'jordan.reed@example.test' },
    update: { name: 'Jordan Reed', location: 'San Francisco', skills: ['React', 'CSS'] },
    create: {
      businessId: 'CAND-000014',
      name: 'Jordan Reed',
      email: 'jordan.reed@example.test',
      phone: '+1 415 555 0199',
      location: 'San Francisco',
      source: 'Referral',
      experienceYears: 4,
      skills: ['React', 'TypeScript', 'CSS'],
    },
  })

  let jordanApp = await prisma.application.findFirst({
    where: { candidateId: jordan.id, requisitionId: req!.id },
  })
  if (!jordanApp) {
    jordanApp = await prisma.application.create({
      data: {
        businessId: `APP-${jordan.businessId}-${req!.businessId}`,
        candidateId: jordan.id,
        requisitionId: req!.id,
        stage: 'Final',
        score: 3.8,
        source: 'Referral',
      },
    })
  } else {
    jordanApp = await prisma.application.update({
      where: { id: jordanApp.id },
      data: { score: 3.8, stage: 'Final' },
    })
  }

  let jordanInterview = await prisma.interview.findFirst({
    where: { applicationId: jordanApp.id },
  })
  if (!jordanInterview) {
    jordanInterview = await prisma.interview.create({
      data: {
        businessId: 'INT-2026-000005',
        applicationId: jordanApp.id,
        panelId: panel!.id,
        title: 'Technical Evaluation - Jordan Reed',
        startAt: new Date(Date.now() - 3600000 * 48),
        endAt: new Date(Date.now() - 3600000 * 47),
        status: 'Completed',
        interviewers: {
          create: { interviewerId: interviewerUser!.interviewer!.id },
        },
      },
    })
  }

  const existingJordanScorecard = await prisma.scorecard.findFirst({
    where: { applicationId: jordanApp.id },
  })
  if (!existingJordanScorecard) {
    await prisma.scorecard.create({
      data: {
        businessId: `SCORE-${jordanInterview.businessId}-${interviewerUser!.businessId}`,
        interviewId: jordanInterview.id,
        interviewerId: interviewerUser!.interviewer!.id,
        applicationId: jordanApp.id,
        recommendation: 'StrongYes',
        notes: 'Solid understanding of core front-end principles.',
        ratings: {
          create: [
            { criterionId: criteriaMap['technical'], rating: 4 },
            { criterionId: criteriaMap['problem'], rating: 4 },
            { criterionId: criteriaMap['communication'], rating: 3 },
            { criterionId: criteriaMap['collaboration'], rating: 4 },
            { criterionId: criteriaMap['values'], rating: 4 },
          ],
        },
      },
    })
  }
})

describe('Pipeline Scorecard Integration & Aggregation', () => {
  it('GET /api/v1/applications includes scorecard aggregates and ratings', async () => {
    const res = await request(app)
      .get('/api/v1/applications')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)

    // Verify fields on returned application DTOs
    for (const appItem of res.body) {
      expect(appItem).toHaveProperty('id')
      expect(appItem).toHaveProperty('candidateName')
      expect(appItem).toHaveProperty('stage')
      expect(appItem).toHaveProperty('score')
      expect(appItem).toHaveProperty('avgRating')
      expect(appItem).toHaveProperty('latestRecommendation')
      expect(appItem).toHaveProperty('scorecardCount')
      expect(appItem).toHaveProperty('hasPendingReview')
    }
  })

  it("reflects John Doe's scorecard rating and recommendation in the pipeline", async () => {
    const res = await request(app)
      .get('/api/v1/applications')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    const johnApp = res.body.find((a: any) => a.candidateName === 'John Doe')
    expect(johnApp).toBeDefined()
    expect(johnApp.score).toBe(4.4)
    expect(johnApp.avgRating).toBe(4.4)
    expect(johnApp.latestRecommendation).toBe('StrongYes')
    expect(johnApp.scorecardCount).toBeGreaterThanOrEqual(1)
    expect(johnApp.hasPendingReview).toBe(false)
  })

  it("reflects Jordan Reed's scorecard rating and recommendation in the pipeline", async () => {
    const res = await request(app)
      .get('/api/v1/applications')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    const jordanApp = res.body.find((a: any) => a.candidateName === 'Jordan Reed')
    expect(jordanApp).toBeDefined()
    expect(jordanApp.score).toBe(3.8)
    expect(jordanApp.avgRating).toBe(3.8)
    expect(jordanApp.latestRecommendation).toBe('StrongYes')
    expect(jordanApp.scorecardCount).toBeGreaterThanOrEqual(1)
  })

  it('dynamically propagates new scorecard submission to application match score and pipeline endpoint', async () => {
    // 1. Create a test candidate, requisition application, and interview
    const candidate = await prisma.candidate.create({
      data: {
        businessId: `CAND-TEST-${Date.now().toString().slice(-6)}`,
        name: 'Alex Rivera Test',
        email: `alex.test.${Date.now()}@example.test`,
        location: 'Remote',
        source: 'Referral',
        experienceYears: 5,
        skills: ['TypeScript', 'Node.js'],
      },
    })

    const req = await prisma.requisition.findFirst({ where: { status: 'Open' } })
    expect(req).toBeDefined()

    const application = await prisma.application.create({
      data: {
        businessId: `APP-TEST-${Date.now().toString().slice(-6)}`,
        candidateId: candidate.id,
        requisitionId: req!.id,
        stage: 'Interview',
        source: 'Referral',
      },
    })

    const panel = await prisma.interviewPanel.findFirst()
    const interviewer = await prisma.interviewer.findFirst({
      include: { user: true },
    })

    const interview = await prisma.interview.create({
      data: {
        businessId: `INT-TEST-${Date.now().toString().slice(-6)}`,
        applicationId: application.id,
        panelId: panel!.id,
        title: 'Technical Evaluation - Alex Rivera',
        startAt: new Date(Date.now() - 3600000 * 2),
        endAt: new Date(Date.now() - 3600000),
        status: 'Completed',
        interviewers: {
          create: {
            interviewerId: interviewer!.id,
          },
        },
      },
    })

    // 2. Before scorecard: pending review should be true, score should be null
    const beforeRes = await request(app)
      .get('/api/v1/applications')
      .set('Authorization', `Bearer ${adminToken}`)
    const appBefore = beforeRes.body.find((a: any) => a.id === application.businessId)
    expect(appBefore).toBeDefined()
    expect(appBefore.score).toBeNull()
    expect(appBefore.avgRating).toBeNull()
    expect(appBefore.scorecardCount).toBe(0)
    expect(appBefore.hasPendingReview).toBe(true)

    // 3. Submit scorecard via POST /api/v1/scorecards
    const submitRes = await request(app)
      .post('/api/v1/scorecards')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        applicationId: application.businessId,
        interviewBusinessId: interview.businessId,
        recommendation: 'StrongYes',
        notes: 'Phenomenal problem solver with exceptional clarity.',
        ratings: {
          technical: 5,
          problem: 5,
          communication: 4,
          collaboration: 5,
          values: 4,
        },
      })
    expect(submitRes.status).toBe(201)

    // Expected average: (5 + 5 + 4 + 5 + 4) / 5 = 4.6
    expect(submitRes.body.recommendation).toBe('StrongYes')

    // 4. Query pipeline applications endpoint: score should now be 4.6, pendingReview false
    const afterRes = await request(app)
      .get('/api/v1/applications')
      .set('Authorization', `Bearer ${adminToken}`)
    const appAfter = afterRes.body.find((a: any) => a.id === application.businessId)
    expect(appAfter).toBeDefined()
    expect(appAfter.score).toBe(4.6)
    expect(appAfter.avgRating).toBe(4.6)
    expect(appAfter.latestRecommendation).toBe('StrongYes')
    expect(appAfter.scorecardCount).toBe(1)
    expect(appAfter.hasPendingReview).toBe(false)

    // 5. Verify database persistence in PostgreSQL directly
    const dbApp = await prisma.application.findUnique({
      where: { id: application.id },
    })
    expect(dbApp).toBeDefined()
    expect(Number(dbApp!.score)).toBe(4.6)
  })
})
