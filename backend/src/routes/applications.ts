import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { authenticate, hydrateUser, requireRoles } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { AppError } from '../middleware/errorHandler'
import { bizId } from '../bizId'
import { audit } from '../services/audit'
import { paginationSchema, paginate, paginatedResponse } from '../utils/pagination'

const router = Router()
router.use(authenticate, hydrateUser)

// ─── Stage FSM ───────────────────────────────────────────────────────────────

type Stage = 'Applied' | 'Screen' | 'Interview' | 'Final' | 'Offer' | 'Hired' | 'Withdrawn'

const STAGE_ORDER: Stage[] = ['Applied', 'Screen', 'Interview', 'Final', 'Offer', 'Hired']

/** Valid transitions (Withdrawn is allowed from any non-terminal stage) */
const VALID_TRANSITIONS: Record<Stage, Stage[]> = {
  Applied: ['Screen', 'Withdrawn'],
  Screen: ['Interview', 'Withdrawn'],
  Interview: ['Final', 'Withdrawn'],
  Final: ['Offer', 'Withdrawn'],
  Offer: ['Hired', 'Withdrawn'],
  Hired: [],
  Withdrawn: [],
}

/** Gate checks before transition */
async function checkGate(applicationId: string, from: Stage, to: Stage): Promise<void> {
  if (to === 'Withdrawn') return // no gate for withdrawal

  if (from === 'Interview' && to === 'Final') {
    // Require at least one completed interview with a submitted scorecard
    const hasScorecard = await prisma.scorecard.findFirst({
      where: { applicationId },
    })
    if (!hasScorecard) {
      throw new AppError(
        422,
        'Cannot advance to Final: at least one submitted scorecard is required from the Interview stage.',
        'GATE_SCORECARD_REQUIRED',
      )
    }
  }

  if (from === 'Final' && to === 'Offer') {
    // Require at least one Yes or StrongYes recommendation
    const positive = await prisma.scorecard.findFirst({
      where: { applicationId, recommendation: { in: ['Yes', 'StrongYes'] } },
    })
    if (!positive) {
      throw new AppError(
        422,
        'Cannot advance to Offer: at least one "Yes" or "Strong Yes" scorecard recommendation is required.',
        'GATE_RECOMMENDATION_REQUIRED',
      )
    }
  }

  if (from === 'Offer' && to === 'Hired') {
    // Require approved and sent offer
    const offer = await prisma.offer.findUnique({ where: { applicationId } })
    if (!offer || offer.status !== 'Sent') {
      throw new AppError(
        422,
        'Cannot mark as Hired: the offer must be Approved and Sent first.',
        'GATE_OFFER_REQUIRED',
      )
    }
  }
}

function toDto(a: {
  businessId: string
  stage: string
  score: unknown
  source: string
  createdAt: Date
  updatedAt: Date
  candidate: { businessId: string; name: string }
  requisition: { businessId: string; title: string }
  scorecards?: Array<{
    id: string
    businessId: string
    recommendation: string
    submittedAt: Date
    ratings: Array<{ rating: number; criterion: { key: string; label: string } }>
  }>
  interviews?: Array<{
    id: string
    businessId: string
    status: string
    scorecards: Array<{ id: string }>
  }>
}) {
  const scorecards = a.scorecards ?? []
  const scorecardCount = scorecards.length

  let avgRating: number | null = null
  let latestRecommendation: string | null = null

  if (scorecardCount > 0) {
    latestRecommendation = scorecards[0].recommendation
    let sum = 0
    let count = 0
    for (const sc of scorecards) {
      for (const r of sc.ratings) {
        sum += r.rating
        count++
      }
    }
    if (count > 0) {
      avgRating = Number((sum / count).toFixed(1))
    }
  }

  const score = a.score !== null && a.score !== undefined ? Number(a.score) : avgRating

  const interviews = a.interviews ?? []
  const hasPendingReview = interviews.some(
    (i) => (i.status === 'Scheduled' || i.status === 'Completed') && i.scorecards.length === 0,
  )

  return {
    id: a.businessId,
    stage: a.stage,
    score,
    avgRating,
    latestRecommendation,
    scorecardCount,
    hasPendingReview,
    source: a.source,
    updatedAt: a.updatedAt.toISOString(),
    createdAt: a.createdAt.toISOString(),
    candidateId: a.candidate.businessId,
    candidateName: a.candidate.name,
    requisitionId: a.requisition.businessId,
    requisitionTitle: a.requisition.title,
  }
}

const appInclude = {
  candidate: { select: { businessId: true, name: true } },
  requisition: { select: { businessId: true, title: true } },
  scorecards: {
    select: {
      id: true,
      businessId: true,
      recommendation: true,
      submittedAt: true,
      ratings: {
        select: {
          rating: true,
          criterion: { select: { key: true, label: true } },
        },
      },
    },
    orderBy: { submittedAt: 'desc' as const },
  },
  interviews: {
    select: {
      id: true,
      businessId: true,
      status: true,
      scorecards: { select: { id: true } },
    },
  },
} as const

/** GET /applications */
router.get('/', async (req, res, next) => {
  try {
    const p = paginationSchema.parse(req.query)
    const { stage, requisitionId, candidateId } = req.query as Record<string, string | undefined>
    const where = {
      ...(stage ? { stage: stage as never } : {}),
      ...(requisitionId ? { requisition: { businessId: requisitionId } } : {}),
      ...(candidateId ? { candidate: { businessId: candidateId } } : {}),
    }
    const [data, total] = await prisma.$transaction([
      prisma.application.findMany({ where, include: appInclude, orderBy: { updatedAt: p.sortDir }, ...paginate(p) }),
      prisma.application.count({ where }),
    ])
    res.json(paginatedResponse(data.map(toDto), total, p))
  } catch (e) { next(e) }
})

/** GET /applications/:id */
router.get('/:id', async (req, res, next) => {
  try {
    const a = await prisma.application.findUnique({ where: { businessId: req.params.id }, include: appInclude })
    if (!a) throw new AppError(404, 'Application not found.', 'NOT_FOUND')
    res.json(toDto(a))
  } catch (e) { next(e) }
})

const createSchema = z.object({
  candidateBusinessId: z.string().min(1),
  requisitionBusinessId: z.string().min(1),
})

/** POST /applications */
router.post('/', requireRoles('Admin', 'Recruiter'), validateBody(createSchema), async (req, res, next) => {
  try {
    const { candidateBusinessId, requisitionBusinessId } = req.body as z.infer<typeof createSchema>
    const [candidate, requisition] = await Promise.all([
      prisma.candidate.findUnique({ where: { businessId: candidateBusinessId } }),
      prisma.requisition.findUnique({ where: { businessId: requisitionBusinessId } }),
    ])
    if (!candidate) throw new AppError(404, 'Candidate not found.', 'NOT_FOUND')
    if (!requisition) throw new AppError(404, 'Requisition not found.', 'NOT_FOUND')
    if (!['Open'].includes(requisition.status)) {
      throw new AppError(422, 'Applications can only be created for Open requisitions.', 'REQ_NOT_OPEN')
    }
    const businessId = `APP-${candidate.businessId}-${requisition.businessId}`
    const a = await prisma.application.create({
      data: {
        businessId, candidateId: candidate.id, requisitionId: requisition.id,
        source: candidate.source, stage: 'Applied',
      },
      include: appInclude,
    })
    await prisma.stageEvent.create({
      data: { applicationId: a.id, toStage: 'Applied', actorId: req.user!.id },
    })
    await audit(req.user!.id, 'Created application', 'Application', a.id, undefined, { businessId: a.businessId })
    res.status(201).json(toDto(a))
  } catch (e) { next(e) }
})

const stageSchema = z.object({
  stage: z.enum(['Applied', 'Screen', 'Interview', 'Final', 'Offer', 'Hired', 'Withdrawn']),
  reason: z.string().max(500).optional(),
})

const handleStageTransition = async (req: any, res: any, next: any) => {
  try {
    const { stage: toStage, reason } = req.body as z.infer<typeof stageSchema>
    const id = req.params.id as string
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    const a = await prisma.application.findFirst({
      where: isUuid ? { OR: [{ businessId: id }, { id }] } : { businessId: id },
      include: appInclude,
    })
    if (!a) throw new AppError(404, 'Application not found.', 'NOT_FOUND')

    const fromStage = a.stage as Stage
    if (!VALID_TRANSITIONS[fromStage].includes(toStage as Stage)) {
      throw new AppError(
        422,
        `Cannot transition from ${fromStage} to ${toStage}. Valid transitions: ${VALID_TRANSITIONS[fromStage].join(', ') || 'none'}.`,
        'INVALID_STAGE_TRANSITION',
      )
    }

    // Gate check
    await checkGate(a.id, fromStage, toStage as Stage)

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.application.update({
        where: { id: a.id }, data: { stage: toStage as never }, include: appInclude,
      })
      await tx.stageEvent.create({
        data: { applicationId: a.id, fromStage: fromStage as never, toStage: toStage as never, actorId: req.user!.id, reason },
      })
      // If withdrawn: cancel all scheduled interviews
      if (toStage === 'Withdrawn') {
        await tx.interview.updateMany({
          where: { applicationId: a.id, status: 'Scheduled' },
          data: { status: 'Cancelled', cancelReason: 'Application withdrawn' },
        })
      }
      return u
    })

    await audit(req.user!.id, `Stage moved ${fromStage} → ${toStage}`, 'Application', a.id, { stage: fromStage }, { stage: toStage })
    res.json(toDto(updated))
  } catch (e) { next(e) }
}

/** PATCH /applications/:id — stage transition */
router.patch('/:id', requireRoles('Admin', 'Recruiter', 'HiringManager'), validateBody(stageSchema), handleStageTransition)

/** PATCH /applications/:id/stage — FSM-enforced stage transition */
router.patch('/:id/stage', requireRoles('Admin', 'Recruiter', 'HiringManager'), validateBody(stageSchema), handleStageTransition)

export default router
