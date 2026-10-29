import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { authenticate, hydrateUser, requireRoles } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { AppError } from '../middleware/errorHandler'
import { audit } from '../services/audit'
import { paginationSchema, paginate, paginatedResponse } from '../utils/pagination'

const router = Router()
router.use(authenticate, hydrateUser)

function scToDto(s: {
  businessId: string
  recommendation: string
  notes: string | null
  submittedAt: Date
  interview: { businessId: string }
  interviewer: { user: { name: string } }
  application: { businessId: string; candidate: { name: string } }
  ratings: { criterion: { key: string; label: string }; rating: number }[]
}) {
  return {
    id: s.businessId,
    recommendation: s.recommendation,
    notes: s.notes,
    submittedAt: s.submittedAt.toISOString(),
    interviewId: s.interview.businessId,
    interviewer: s.interviewer.user.name,
    applicationId: s.application.businessId,
    candidateName: s.application.candidate.name,
    ratings: Object.fromEntries(s.ratings.map((r) => [r.criterion.key, r.rating])),
  }
}

const scInclude = {
  interview: { select: { businessId: true } },
  interviewer: { include: { user: { select: { name: true } } } },
  application: { include: { candidate: { select: { name: true } } } },
  ratings: { include: { criterion: { select: { key: true, label: true } } } },
} as const

/** GET /scorecards */
router.get('/', async (req, res, next) => {
  try {
    const p = paginationSchema.parse(req.query)
    const { applicationId } = req.query as Record<string, string | undefined>
    const isAppUuid = applicationId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(applicationId)
    const where = applicationId
      ? {
          application: isAppUuid
            ? { OR: [{ businessId: applicationId }, { id: applicationId }] }
            : { businessId: applicationId },
        }
      : {}

    const [data, total] = await prisma.$transaction([
      prisma.scorecard.findMany({ where, include: scInclude, orderBy: { submittedAt: p.sortDir }, ...paginate(p) }),
      prisma.scorecard.count({ where }),
    ])
    res.json(paginatedResponse(data.map(scToDto), total, p))
  } catch (e) {
    next(e)
  }
})

/** GET /scorecards/rubric — return all rubric criteria */
router.get('/rubric', async (_req, res, next) => {
  try {
    const criteria = await prisma.rubricCriterion.findMany({ orderBy: { label: 'asc' } })
    res.json(criteria.map((c) => ({ id: c.id, key: c.key, label: c.label, hint: c.hint, applicableStages: c.applicableStages })))
  } catch (e) {
    next(e)
  }
})

const submitSchema = z.object({
  interviewBusinessId: z.string().min(1).optional(),
  interviewId: z.string().min(1).optional(),
  applicationId: z.string().min(1).optional(),
  applicationBusinessId: z.string().min(1).optional(),
  ratings: z.record(z.string(), z.coerce.number().int().min(1).max(5)),
  recommendation: z
    .enum(['StrongYes', 'Yes', 'No', 'StrongNo', 'Strong yes', 'Strong no', 'Strong Yes', 'Strong No'])
    .transform((val) => {
      const lower = val.toLowerCase().replace(/\s+/g, '')
      if (lower === 'strongyes') return 'StrongYes'
      if (lower === 'strongno') return 'StrongNo'
      if (lower === 'yes') return 'Yes'
      return 'No'
    }),
  notes: z.string().max(2000).optional().nullable(),
})

/** POST /scorecards */
router.post(
  '/',
  requireRoles('Admin', 'Interviewer', 'HiringManager'),
  validateBody(submitSchema),
  async (req, res, next) => {
    try {
      const { interviewBusinessId, interviewId, applicationId, applicationBusinessId, ratings, recommendation, notes } =
        req.body as z.infer<typeof submitSchema>

      const intIdentifier = interviewBusinessId || interviewId
      const appIdentifier = applicationId || applicationBusinessId

      if (!intIdentifier && !appIdentifier) {
        throw new AppError(400, 'Either interviewBusinessId or applicationId must be provided.', 'VALIDATION_ERROR')
      }

      let interview: any = null

      if (intIdentifier) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(intIdentifier)
        interview = await prisma.interview.findFirst({
          where: isUuid ? { OR: [{ businessId: intIdentifier }, { id: intIdentifier }] } : { businessId: intIdentifier },
          include: {
            application: { include: { candidate: true } },
            interviewers: { include: { interviewer: { include: { user: true } } } },
          },
        })
      } else if (appIdentifier) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appIdentifier)
        interview = await prisma.interview.findFirst({
          where: {
            application: isUuid ? { OR: [{ businessId: appIdentifier }, { id: appIdentifier }] } : { businessId: appIdentifier },
            status: { not: 'Cancelled' },
          },
          orderBy: { createdAt: 'desc' },
          include: {
            application: { include: { candidate: true } },
            interviewers: { include: { interviewer: { include: { user: true } } } },
          },
        })
      }

      if (!interview) {
        throw new AppError(404, 'Interview not found for this candidate.', 'NOT_FOUND')
      }
      if (interview.status === 'Cancelled') {
        throw new AppError(422, 'Cannot submit scorecard for a cancelled interview.', 'INTERVIEW_CANCELLED')
      }

      const userRole = req.user!.role
      const userId = req.user!.id

      // Find the interviewer record for the current user (if one exists)
      const interviewerRecord = await prisma.interviewer.findFirst({ where: { userId } })

      let interviewerId: string | undefined

      if (userRole === 'Admin') {
        // Admin oversight: Admin can submit on behalf of assigned interviewer or their own interviewer profile
        interviewerId = interviewerRecord?.id ?? interview.interviewers[0]?.interviewerId
        if (!interviewerId) {
          throw new AppError(422, 'No interviewer record found for this interview panel.', 'NO_INTERVIEWER')
        }
      } else if (userRole === 'Interviewer' || userRole === 'HiringManager') {
        if (!interviewerRecord) {
          throw new AppError(403, 'You do not have an interviewer profile to submit scorecards.', 'FORBIDDEN')
        }
        // Strict assignment check: Interviewer MUST be assigned to this interview's panel
        const isAssigned = interview.interviewers.some((x: any) => x.interviewerId === interviewerRecord.id)
        if (!isAssigned) {
          throw new AppError(403, 'You are not assigned to the interview panel for this interview.', 'FORBIDDEN')
        }
        interviewerId = interviewerRecord.id
      } else {
        throw new AppError(403, 'You do not have permission to submit scorecards.', 'FORBIDDEN')
      }

      // Check for duplicate scorecard
      const existing = await prisma.scorecard.findUnique({
        where: { interviewId_interviewerId: { interviewId: interview.id, interviewerId } },
      })
      if (existing) {
        throw new AppError(409, 'A scorecard from this interviewer for this interview already exists.', 'DUPLICATE_SCORECARD')
      }

      // Validate criteria against DB
      const allCriteria = await prisma.rubricCriterion.findMany()
      const criteriaMap = Object.fromEntries(allCriteria.map((c) => [c.key, c]))

      if (Object.keys(ratings).length === 0) {
        throw new AppError(400, 'At least one criterion rating is required.', 'VALIDATION_ERROR')
      }

      for (const [key, rating] of Object.entries(ratings)) {
        const criterion = criteriaMap[key]
        if (!criterion) {
          throw new AppError(422, `Unknown rubric criterion: "${key}".`, 'UNKNOWN_CRITERION')
        }
        if (typeof rating !== 'number' || rating < 1 || rating > 5) {
          throw new AppError(400, `Rating for "${key}" must be an integer between 1 and 5.`, 'VALIDATION_ERROR')
        }
      }

      const intBid = interview.businessId
      const ivrUserBid =
        interview.interviewers.find((x: any) => x.interviewerId === interviewerId)?.interviewer.user.businessId ??
        req.user!.businessId ??
        'IVR'
      const scorecardBid = `SCORE-${intBid}-${ivrUserBid}`

      const scorecard = await prisma.scorecard.create({
        data: {
          businessId: scorecardBid,
          interviewId: interview.id,
          interviewerId,
          applicationId: interview.applicationId,
          recommendation: recommendation as any,
          notes: notes || null,
          ratings: {
            create: Object.entries(ratings).map(([key, rating]) => ({
              criterionId: criteriaMap[key].id,
              rating: rating as number,
            })),
          },
        },
        include: scInclude,
      })

      // Recalculate and update the application match score based on submitted scorecards
      const allAppScorecards = await prisma.scorecard.findMany({
        where: { applicationId: interview.applicationId },
        include: { ratings: true },
      })
      let totalSum = 0
      let totalCount = 0
      for (const sc of allAppScorecards) {
        for (const r of sc.ratings) {
          totalSum += r.rating
          totalCount++
        }
      }
      if (totalCount > 0) {
        const calculatedAvg = Number((totalSum / totalCount).toFixed(2))
        await prisma.application.update({
          where: { id: interview.applicationId },
          data: { score: calculatedAvg },
        })
      }

      await audit(req.user!.id, 'Submitted scorecard', 'Scorecard', scorecard.id, undefined, {
        businessId: scorecard.businessId,
        interviewBusinessId: interview.businessId,
        candidateName: interview.application.candidate.name,
        recommendation,
        interviewerId,
      })

      res.status(201).json(scToDto(scorecard))
    } catch (e) {
      next(e)
    }
  },
)

export default router
