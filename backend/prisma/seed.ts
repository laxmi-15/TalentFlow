// TalentFlow Database Seed — Small Starter Profile
// Seeds: settings, rubric criteria, users, hiring managers, interviewers, panels,
// requisitions, candidates, applications, stage events, interviews, scorecards,
// offers, approvals, anomalies and audit events.
import {
  PrismaClient,
  UserRole,
  CandidateSource,
  ApplicationStage,
  InterviewStatus,
  ScorecardRecommendation,
  OfferStatus,
  ApprovalStatus,
  ApprovalSubjectType,
  RequisitionStatus,
  AnomalyStatus,
  GenerationProfile,
  GenerationStatus,
} from '@prisma/client'
import bcrypt from 'bcryptjs'
import { seedEvaluationFixtures } from '../src/fixtures/evaluationFixtures'
import { runAnomalyDetection } from '../src/services/anomalyDetector'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding TalentFlow small starter profile...')

  // ── 1. Settings ───────────────────────────────────────────────────────────
  await prisma.settings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      orgName: 'Northwind Talent Co.',
      timezone: 'Asia/Kolkata',
      requireOfferApproval: true,
    },
  })
  console.log('  ✓ Settings')

  // ── 2. Rubric Criteria ────────────────────────────────────────────────────
  const rubricData = [
    { key: 'technical', label: 'Technical depth', hint: 'Domain knowledge and quality of solutions', applicableStages: ['Interview', 'Final'] },
    { key: 'problem', label: 'Problem solving', hint: 'Structure, trade-offs and handling ambiguity', applicableStages: ['Interview', 'Final'] },
    { key: 'communication', label: 'Communication', hint: 'Clarity, listening and concision', applicableStages: ['Screen', 'Interview', 'Final'] },
    { key: 'collaboration', label: 'Collaboration', hint: 'Working with others and giving feedback', applicableStages: ['Interview', 'Final'] },
    { key: 'values', label: 'Values alignment', hint: 'Ownership, curiosity and integrity', applicableStages: ['Final'] },
  ]
  const criteriaMap: Record<string, string> = {}
  for (const c of rubricData) {
    const rc = await prisma.rubricCriterion.upsert({
      where: { key: c.key },
      update: {},
      create: c,
    })
    criteriaMap[rc.key] = rc.id
  }
  console.log('  ✓ Rubric criteria (5)')

  // ── 3. Users & Roles ──────────────────────────────────────────────────────
  const hash = await bcrypt.hash('TalentFlow2026!', 12)
  const userData = [
    { name: 'Meera Joshi', email: 'meera@example.test', role: UserRole.Admin },
    { name: 'Chris Alder', email: 'chris@example.test', role: UserRole.Recruiter },
    { name: 'Dana Whitfield', email: 'dana@example.test', role: UserRole.HiringManager },
    { name: 'Samir Qureshi', email: 'samir@example.test', role: UserRole.Interviewer },
    { name: 'Lena Fischer', email: 'lena@example.test', role: UserRole.Approver },
    { name: 'Paulo Mendes', email: 'paulo@example.test', role: UserRole.Recruiter },
    { name: 'Yuki Tanaka', email: 'yuki@example.test', role: UserRole.HiringManager },
    { name: 'Grace Mbeki', email: 'grace@example.test', role: UserRole.Interviewer },
    { name: 'Tomas Reyes', email: 'tomas@example.test', role: UserRole.Interviewer },
    { name: 'Priya Raman', email: 'priya@example.test', role: UserRole.Approver },
  ]

  const users: Array<{ id: string; businessId: string; name: string; role: UserRole }> = []
  for (let i = 0; i < userData.length; i++) {
    const u = userData[i]
    const businessId = `USR-${String(i + 1).padStart(6, '0')}`
    const record = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, active: true },
      create: { businessId, name: u.name, email: u.email, role: u.role, passwordHash: hash },
    })
    users.push({ id: record.id, businessId: record.businessId, name: record.name, role: record.role })
  }
  console.log(`  ✓ Users (${users.length})`)

  // ── 4. Hiring Managers ────────────────────────────────────────────────────
  const hmUsers = users.filter((u) => u.role === UserRole.HiringManager)
  const hmDepartments = ['Engineering', 'Design', 'Analytics', 'Sales']
  const hmRecords: Array<{ id: string; userId: string }> = []
  for (let i = 0; i < hmUsers.length; i++) {
    const hm = await prisma.hiringManager.upsert({
      where: { userId: hmUsers[i].id },
      update: {},
      create: { userId: hmUsers[i].id, department: hmDepartments[i % hmDepartments.length] },
    })
    hmRecords.push(hm)
  }
  console.log(`  ✓ Hiring managers (${hmRecords.length})`)

  // ── 5. Interviewers with Availability ─────────────────────────────────────
  const ivrUsers = users.filter((u) => u.role === UserRole.Interviewer)
  const ivrRecords: Array<{ id: string; userId: string }> = []
  for (let i = 0; i < ivrUsers.length; i++) {
    const existing = await prisma.interviewer.findUnique({ where: { userId: ivrUsers[i].id } })
    if (!existing) {
      const ivr = await prisma.interviewer.create({
        data: {
          userId: ivrUsers[i].id,
          team: hmDepartments[i % hmDepartments.length],
          availability: {
            create: Array.from({ length: 5 }, (_, day) =>
              Array.from({ length: 3 }, (_, block) => ({
                dayOfWeek: day,
                block,
                free: (day + block + i) % 2 === 0,
              })),
            ).flat(),
          },
        },
      })
      ivrRecords.push(ivr)
    } else {
      ivrRecords.push(existing)
    }
  }
  console.log(`  ✓ Interviewers (${ivrRecords.length}) with availability`)

  // ── 6. Interview Panels ───────────────────────────────────────────────────
  const panelData = [
    { name: 'Backend Engineering Loop', focus: 'System design, code quality, scalability', memberIndices: [0, 1] },
    { name: 'Design Critique Panel', focus: 'Portfolio review, visual craft, UX thinking', memberIndices: [1] },
    { name: 'Commercial Panel', focus: 'Pipeline, negotiation, customer empathy', memberIndices: [2] },
  ]
  const panelRecords: Array<{ id: string; businessId: string; name: string }> = []
  for (let i = 0; i < panelData.length; i++) {
    const pd = panelData[i]
    const bid = `PNL-${String(i + 1).padStart(6, '0')}`
    let panel = await prisma.interviewPanel.findUnique({ where: { businessId: bid } })
    if (!panel) {
      panel = await prisma.interviewPanel.create({
        data: {
          businessId: bid,
          name: pd.name,
          focus: pd.focus,
          members: {
            create: pd.memberIndices
              .filter((idx) => idx < ivrRecords.length)
              .map((idx) => ({ interviewerId: ivrRecords[idx].id })),
          },
        },
      })
    }
    panelRecords.push(panel)
  }
  console.log(`  ✓ Interview panels (${panelRecords.length})`)

  // ── 7. Requisitions ───────────────────────────────────────────────────────
  const year = new Date().getFullYear()
  const reqData = [
    {
      bid: `REQ-${year}-000001`,
      title: 'Senior Backend Engineer',
      dept: 'Engineering',
      loc: 'Pune',
      headcount: 2,
      status: RequisitionStatus.Open,
      min: 130000,
      max: 175000,
      hmIndex: 0,
      skills: [{ skill: 'TypeScript', required: true, minYears: 5 }, { skill: 'PostgreSQL', required: true, minYears: 3 }, { skill: 'Kubernetes', required: false, minYears: 2 }],
    },
    {
      bid: `REQ-${year}-000002`,
      title: 'Product Designer',
      dept: 'Design',
      loc: 'Remote',
      headcount: 1,
      status: RequisitionStatus.Open,
      min: 95000,
      max: 135000,
      hmIndex: 1,
      skills: [{ skill: 'Figma', required: true, minYears: 4 }, { skill: 'Design Systems', required: true, minYears: 3 }],
    },
    {
      bid: `REQ-${year}-000003`,
      title: 'Data Analyst',
      dept: 'Analytics',
      loc: 'Remote',
      headcount: 2,
      status: RequisitionStatus.Open,
      min: 80000,
      max: 115000,
      hmIndex: 0,
      skills: [{ skill: 'SQL', required: true, minYears: 3 }, { skill: 'Python', required: true, minYears: 2 }],
    },
    {
      bid: `REQ-${year}-000004`,
      title: 'Frontend Engineer',
      dept: 'Engineering',
      loc: 'Berlin',
      headcount: 1,
      status: RequisitionStatus.Open,
      min: 110000,
      max: 155000,
      hmIndex: 0,
      skills: [{ skill: 'React', required: true, minYears: 4 }, { skill: 'TypeScript', required: true, minYears: 3 }],
    },
    {
      bid: `REQ-${year}-000005`,
      title: 'Security Engineer',
      dept: 'Engineering',
      loc: 'Remote',
      headcount: 1,
      status: RequisitionStatus.PendingApproval,
      min: 140000,
      max: 190000,
      hmIndex: 0,
      skills: [{ skill: 'Security', required: true, minYears: 5 }, { skill: 'Cloud Architecture', required: true, minYears: 4 }],
    },
    {
      bid: `REQ-${year}-000006`,
      title: 'Product Manager',
      dept: 'Design',
      loc: 'Austin',
      headcount: 1,
      status: RequisitionStatus.Draft,
      min: 120000,
      max: 165000,
      hmIndex: 1,
      skills: [{ skill: 'Product Strategy', required: true, minYears: 4 }],
    },
  ]

  const reqRecords: Array<{ id: string; businessId: string; title: string }> = []
  for (const r of reqData) {
    let req = await prisma.requisition.findUnique({ where: { businessId: r.bid } })
    if (!req) {
      req = await prisma.requisition.create({
        data: {
          businessId: r.bid,
          title: r.title,
          department: r.dept,
          location: r.loc,
          headcount: r.headcount,
          status: r.status,
          bandMin: r.min,
          bandMax: r.max,
          hiringManagerId: hmRecords[r.hmIndex % hmRecords.length].id,
          skillRequirements: {
            create: r.skills.map((s) => ({ skill: s.skill, required: s.required, minYears: s.minYears })),
          },
        },
      })
    }
    reqRecords.push(req)
  }
  console.log(`  ✓ Requisitions (${reqRecords.length})`)

  // ── 8. Candidates ─────────────────────────────────────────────────────────
  const candData = [
    { name: 'Aarav Patel', email: 'aarav.patel@example.test', phone: '+91 98200 11223', loc: 'Pune', source: CandidateSource.Referral, exp: 7, skills: ['TypeScript', 'Python', 'SQL', 'Kubernetes'] },
    { name: 'Sofia Müller', email: 'sofia.mueller@example.test', phone: '+49 170 998877', loc: 'Berlin', source: CandidateSource.JobBoard, exp: 5, skills: ['Figma', 'React', 'Research'] },
    { name: 'Rohan Sharma', email: 'rohan.sharma@example.test', phone: '+91 98400 33445', loc: 'Remote', source: CandidateSource.CareerssSite, exp: 4, skills: ['Python', 'SQL', 'Data Modelling'] },
    { name: 'Elena Rossi', email: 'elena.rossi@example.test', phone: '+39 02 887766', loc: 'Remote', source: CandidateSource.Agency, exp: 6, skills: ['React', 'TypeScript', 'Figma'] },
    { name: 'Marcus Vance', email: 'marcus.vance@example.test', phone: '+1 512 555 0192', loc: 'Austin', source: CandidateSource.Referral, exp: 8, skills: ['Go', 'Kubernetes', 'Security'] },
    { name: 'Ananya Iyer', email: 'ananya.iyer@example.test', phone: '+91 98111 22334', loc: 'Pune', source: CandidateSource.JobBoard, exp: 3, skills: ['TypeScript', 'React', 'SQL'] },
    { name: 'Lucas Dupont', email: 'lucas.dupont@example.test', phone: '+33 6 1234 5678', loc: 'Remote', source: CandidateSource.Campus, exp: 2, skills: ['Python', 'SQL', 'Excel'] },
    { name: 'Chloe Bennett', email: 'chloe.bennett@example.test', phone: '+1 415 555 0134', loc: 'Remote', source: CandidateSource.CareerssSite, exp: 6, skills: ['Figma', 'Research', 'Product Strategy'] },
    { name: 'Vikram Malhotra', email: 'vikram.malhotra@example.test', phone: '+91 98333 44556', loc: 'Pune', source: CandidateSource.Referral, exp: 9, skills: ['Java', 'SQL', 'Security', 'Leadership'] },
    { name: 'Fatima Zahra', email: 'fatima.zahra@example.test', phone: '+44 20 7946 0912', loc: 'Remote', source: CandidateSource.JobBoard, exp: 4, skills: ['React', 'TypeScript', 'Python'] },
  ]

  const candRecords: Array<{ id: string; businessId: string; name: string }> = []
  for (let i = 0; i < candData.length; i++) {
    const c = candData[i]
    const bid = `CAND-${String(i + 1).padStart(6, '0')}`
    const cand = await prisma.candidate.upsert({
      where: { email: c.email },
      update: { name: c.name, location: c.loc, skills: c.skills, experienceYears: c.exp },
      create: {
        businessId: bid,
        name: c.name,
        email: c.email,
        phone: c.phone,
        location: c.loc,
        source: c.source,
        experienceYears: c.exp,
        skills: c.skills,
      },
    })
    candRecords.push(cand)
  }
  console.log(`  ✓ Candidates (${candRecords.length})`)

  // ── 9. Applications ───────────────────────────────────────────────────────
  const appMappings = [
    { candIdx: 0, reqIdx: 0, stage: ApplicationStage.Offer, score: 4.8 },
    { candIdx: 1, reqIdx: 1, stage: ApplicationStage.Interview, score: 4.2 },
    { candIdx: 2, reqIdx: 2, stage: ApplicationStage.Final, score: 4.5 },
    { candIdx: 3, reqIdx: 3, stage: ApplicationStage.Hired, score: 4.9 },
    { candIdx: 4, reqIdx: 0, stage: ApplicationStage.Interview, score: 3.8 },
    { candIdx: 5, reqIdx: 0, stage: ApplicationStage.Screen, score: 3.5 },
    { candIdx: 6, reqIdx: 2, stage: ApplicationStage.Applied, score: null },
    { candIdx: 7, reqIdx: 1, stage: ApplicationStage.Applied, score: null },
    { candIdx: 8, reqIdx: 0, stage: ApplicationStage.Screen, score: 3.7 },
    { candIdx: 9, reqIdx: 3, stage: ApplicationStage.Interview, score: 4.0 },
  ]

  const appRecords: Array<{ id: string; businessId: string; candidateId: string; requisitionId: string }> = []
  const recruiter = users.find((u) => u.role === UserRole.Recruiter) ?? users[0]

  for (const m of appMappings) {
    const cand = candRecords[m.candIdx]
    const req = reqRecords[m.reqIdx]
    const bid = `APP-${cand.businessId}-${req.businessId}`

    let app = await prisma.application.findUnique({ where: { businessId: bid } })
    if (!app) {
      app = await prisma.application.create({
        data: {
          businessId: bid,
          candidateId: cand.id,
          requisitionId: req.id,
          stage: m.stage,
          score: m.score,
          source: candData[m.candIdx].source,
          stageEvents: {
            create: [
              { fromStage: null, toStage: ApplicationStage.Applied, actorId: recruiter.id, reason: 'Application received' },
              ...(m.stage !== ApplicationStage.Applied
                ? [{ fromStage: ApplicationStage.Applied, toStage: m.stage, actorId: recruiter.id, reason: 'Advanced in process' }]
                : []),
            ],
          },
        },
      })
    }
    appRecords.push(app)
  }
  console.log(`  ✓ Applications (${appRecords.length})`)

  // ── 10. Interviews ────────────────────────────────────────────────────────
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  tomorrow.setUTCHours(10, 0, 0, 0)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  yesterday.setUTCHours(14, 0, 0, 0)
  const nextWeek = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)
  nextWeek.setUTCHours(11, 0, 0, 0)

  const interviewData = [
    {
      bid: `INT-${year}-000001`,
      appIdx: 1, // Sofia Müller
      panelIdx: 1, // Design Critique Panel
      title: 'Design Critique Panel',
      startAt: tomorrow,
      endAt: new Date(tomorrow.getTime() + 60 * 60 * 1000),
      status: InterviewStatus.Scheduled,
    },
    {
      bid: `INT-${year}-000002`,
      appIdx: 0, // Aarav Patel
      panelIdx: 0, // Backend Loop
      title: 'Backend Engineering Loop',
      startAt: yesterday,
      endAt: new Date(yesterday.getTime() + 60 * 60 * 1000),
      status: InterviewStatus.Completed,
    },
    {
      bid: `INT-${year}-000003`,
      appIdx: 9, // Fatima Zahra
      panelIdx: 0, // Backend Loop
      title: 'Frontend Technical Interview',
      startAt: nextWeek,
      endAt: new Date(nextWeek.getTime() + 45 * 60 * 1000),
      status: InterviewStatus.Scheduled,
    },
  ]

  const interviewRecords: Array<{ id: string; businessId: string }> = []
  for (const iv of interviewData) {
    let intv = await prisma.interview.findUnique({ where: { businessId: iv.bid } })
    if (!intv) {
      intv = await prisma.interview.create({
        data: {
          businessId: iv.bid,
          applicationId: appRecords[iv.appIdx].id,
          panelId: panelRecords[iv.panelIdx].id,
          title: iv.title,
          startAt: iv.startAt,
          endAt: iv.endAt,
          status: iv.status,
          interviewers: {
            create: ivrRecords.slice(0, 2).map((r) => ({ interviewerId: r.id })),
          },
        },
      })
    }
    interviewRecords.push(intv)
  }
  console.log(`  ✓ Interviews (${interviewRecords.length})`)

  // ── 11. Scorecards ────────────────────────────────────────────────────────
  const completedInterview = interviewRecords[1] // INT-2026-000002
  const leadInterviewer = ivrRecords[0]
  const scorecardBid = `SCORE-${completedInterview.businessId}-${users[3].businessId}`

  const existingScorecard = await prisma.scorecard.findUnique({ where: { businessId: scorecardBid } })
  if (!existingScorecard) {
    await prisma.scorecard.create({
      data: {
        businessId: scorecardBid,
        interviewId: completedInterview.id,
        interviewerId: leadInterviewer.id,
        applicationId: appRecords[0].id,
        recommendation: ScorecardRecommendation.StrongYes,
        notes: 'Outstanding technical depth, strong architectural instincts and clear communication.',
        ratings: {
          create: [
            { criterionId: criteriaMap['technical'], rating: 5 },
            { criterionId: criteriaMap['problem'], rating: 5 },
            { criterionId: criteriaMap['communication'], rating: 4 },
            { criterionId: criteriaMap['collaboration'], rating: 5 },
            { criterionId: criteriaMap['values'], rating: 5 },
          ],
        },
      },
    })
  }
  console.log('  ✓ Scorecards (1 with full criteria ratings)')

  // ── 12. Offers ────────────────────────────────────────────────────────────
  const offerBid = `OFF-${year}-000001`
  let offerRecord = await prisma.offer.findUnique({ where: { businessId: offerBid } })
  if (!offerRecord) {
    offerRecord = await prisma.offer.create({
      data: {
        businessId: offerBid,
        applicationId: appRecords[0].id, // Aarav Patel
        base: 155000,
        bonusPct: 10,
        bandMin: 130000,
        bandMax: 175000,
        status: OfferStatus.PendingApproval,
        outOfBand: false,
      },
    })
  }
  console.log('  ✓ Offers (1 pending approval)')

  // ── 13. Approvals ─────────────────────────────────────────────────────────
  const approvalsData = [
    {
      bid: 'APR-000001',
      type: ApprovalSubjectType.Requisition,
      subjectId: reqRecords[4].id, // Security Engineer
      label: `${reqRecords[4].businessId} — Security Engineer`,
      requesterId: recruiter.id,
      status: ApprovalStatus.Pending,
    },
    {
      bid: 'APR-000002',
      type: ApprovalSubjectType.Offer,
      subjectId: offerRecord.id,
      label: `Aarav Patel — Senior Backend Engineer`,
      requesterId: recruiter.id,
      status: ApprovalStatus.Pending,
    },
  ]

  for (const ap of approvalsData) {
    await prisma.approval.upsert({
      where: { businessId: ap.bid },
      update: { status: ap.status },
      create: {
        businessId: ap.bid,
        subjectType: ap.type,
        subjectId: ap.subjectId,
        subjectLabel: ap.label,
        requestedById: ap.requesterId,
        status: ap.status,
      },
    })
  }
  console.log('  ✓ Approvals (2 pending)')

  // ── 14. Generation Run & Anomalies ────────────────────────────────────────
  const genBid = 'GEN-000001'
  let genRun = await prisma.generationRun.findUnique({ where: { businessId: genBid } })
  if (!genRun) {
    genRun = await prisma.generationRun.create({
      data: {
        businessId: genBid,
        seed: BigInt(20261022),
        profile: GenerationProfile.starter,
        generatorVersion: '1.0.0',
        status: GenerationStatus.Completed,
        rowCounts: { requisitions: 6, candidates: 10, applications: 10, interviews: 3 },
      },
    })
  }

  const anomaliesData = [
    {
      check: 'interviewer_availability',
      issueType: 'InterviewerDoubleBooked',
      severity: 'High',
      status: AnomalyStatus.Open,
      recordId: interviewRecords[0].businessId,
      decision: 'Reschedule interview',
    },
    {
      check: 'offer_band_check',
      issueType: 'OfferExceedsBand',
      severity: 'Medium',
      status: AnomalyStatus.Investigating,
      recordId: offerBid,
      decision: 'Request comp committee review',
    },
    {
      check: 'review_timeline',
      issueType: 'MissingReview',
      severity: 'Low',
      status: AnomalyStatus.Resolved,
      recordId: interviewRecords[1].businessId,
      decision: 'Review submitted',
    },
  ]

  for (const an of anomaliesData) {
    const existing = await prisma.validationResult.findFirst({
      where: { generationRunId: genRun.id, checkName: an.check },
    })
    if (!existing) {
      await prisma.validationResult.create({
        data: {
          generationRunId: genRun.id,
          checkName: an.check,
          issueType: an.issueType,
          severity: an.severity,
          status: an.status,
          isAnomaly: true,
          detected: true,
          affectedRecordId: an.recordId,
          expectedDecision: an.decision,
        },
      })
    }
  }
  console.log('  ✓ Starter anomalies (3 validation results)')

  // ── 14b. Evaluation Fixtures & Detector Run ───────────────────────────────
  await seedEvaluationFixtures(prisma)
  await runAnomalyDetection(prisma)
  console.log('  ✓ Evaluation fixtures & 5 anomaly types synchronized')

  // ── 15. Audit Events ──────────────────────────────────────────────────────
  const auditData = [
    { bid: 'AUD-000001', actorId: users[0].id, action: 'Created requisition', entity: 'Requisition', entityId: reqRecords[0].id },
    { bid: 'AUD-000002', actorId: recruiter.id, action: 'Advanced application to Offer', entity: 'Application', entityId: appRecords[0].id },
    { bid: 'AUD-000003', actorId: users[3].id, action: 'Submitted interview scorecard', entity: 'Scorecard', entityId: completedInterview.id },
  ]
  for (const au of auditData) {
    await prisma.auditEvent.upsert({
      where: { businessId: au.bid },
      update: {},
      create: {
        businessId: au.bid,
        actorId: au.actorId,
        action: au.action,
        entityType: au.entity,
        entityId: au.entityId,
      },
    })
  }
  console.log('  ✓ Audit events (3)')

  // ── 16. Initialize ID Sequences ───────────────────────────────────────────
  const sequences = [
    { scope: 'USR', nextVal: users.length + 1 },
    { scope: `REQ-${year}`, nextVal: reqRecords.length + 1 },
    { scope: 'CAND', nextVal: candRecords.length + 1 },
    { scope: `INT-${year}`, nextVal: interviewRecords.length + 1 },
    { scope: `OFF-${year}`, nextVal: 2 },
    { scope: 'APR', nextVal: 3 },
    { scope: 'AUD', nextVal: 4 },
    { scope: 'GEN', nextVal: 2 },
    { scope: 'PNL', nextVal: panelRecords.length + 1 },
  ]
  for (const seq of sequences) {
    await prisma.$executeRaw`
      INSERT INTO id_sequences (scope, next_val, updated_at)
      VALUES (${seq.scope}, ${seq.nextVal}, now())
      ON CONFLICT (scope) DO UPDATE
        SET next_val = EXCLUDED.next_val, updated_at = now()
    `
  }
  console.log('  ✓ ID sequences synchronized')

  console.log('\n✅ Starter profile seed complete!')
  console.log('\n📋 Default login credentials (all roles):')
  console.log('   Admin:          meera@example.test  / TalentFlow2026!')
  console.log('   Recruiter:      chris@example.test  / TalentFlow2026!')
  console.log('   Hiring Manager: dana@example.test   / TalentFlow2026!')
  console.log('   Interviewer:    samir@example.test  / TalentFlow2026!')
  console.log('   Approver:       lena@example.test   / TalentFlow2026!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
