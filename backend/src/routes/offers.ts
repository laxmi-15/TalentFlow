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

function offerToDto(o: {
  businessId: string; base: unknown; bonusPct: unknown; bandMin: unknown; bandMax: unknown;
  status: string; outOfBand: boolean; createdAt: Date; updatedAt: Date;
  application: { businessId: string; candidate: { name: string }; requisition: { title: string } };
}) {
  return {
    id: o.businessId,
    status: o.status === 'PendingApproval' ? 'Pending approval' : o.status,
    outOfBand: o.outOfBand,
    base: Number(o.base), bonusPct: Number(o.bonusPct),
    bandMin: Number(o.bandMin), bandMax: Number(o.bandMax),
    applicationId: o.application.businessId,
    candidateName: o.application.candidate.name,
    role: o.application.requisition.title,
    createdAt: o.createdAt.toISOString(), updatedAt: o.updatedAt.toISOString(),
  }
}

const offerInclude = {
  application: {
    include: {
      candidate: { select: { name: true } },
      requisition: { select: { title: true, bandMin: true, bandMax: true } },
    },
  },
} as const

/** GET /offers */
router.get('/', async (req, res, next) => {
  try {
    const p = paginationSchema.parse(req.query)
    const { status } = req.query as Record<string, string | undefined>
    const where = status ? { status: status as never } : {}
    const [data, total] = await prisma.$transaction([
      prisma.offer.findMany({ where, include: offerInclude, orderBy: { createdAt: p.sortDir }, ...paginate(p) }),
      prisma.offer.count({ where }),
    ])
    res.json(paginatedResponse(data.map(offerToDto), total, p))
  } catch (e) { next(e) }
})

/** GET /offers/:id */
router.get('/:id', async (req, res, next) => {
  try {
    const o = await prisma.offer.findUnique({ where: { businessId: req.params.id }, include: offerInclude })
    if (!o) throw new AppError(404, 'Offer not found.', 'NOT_FOUND')
    res.json(offerToDto(o))
  } catch (e) { next(e) }
})

const createSchema = z.object({
  applicationBusinessId: z.string().min(1),
  base: z.number().positive(),
  bonusPct: z.number().min(0).max(100),
})

/** POST /offers
 * - One offer per application
 * - Auto-detects out-of-band (base > bandMax)
 * - Creates approval record automatically
 */
router.post('/', requireRoles('Admin', 'Recruiter', 'HiringManager'), validateBody(createSchema), async (req, res, next) => {
  try {
    const { applicationBusinessId, base, bonusPct } = req.body as z.infer<typeof createSchema>

    const application = await prisma.application.findUnique({
      where: { businessId: applicationBusinessId },
      include: { requisition: { select: { bandMin: true, bandMax: true, title: true } }, candidate: { select: { name: true } } },
    })
    if (!application) throw new AppError(404, 'Application not found.', 'NOT_FOUND')
    if (!['Final', 'Offer'].includes(application.stage)) {
      throw new AppError(422, 'Offers can only be created for applications in Final or Offer stage.', 'INVALID_APP_STAGE')
    }

    const existing = await prisma.offer.findUnique({ where: { applicationId: application.id } })
    if (existing) throw new AppError(409, 'An offer already exists for this application.', 'DUPLICATE_OFFER')

    const bandMin = Number(application.requisition.bandMin)
    const bandMax = Number(application.requisition.bandMax)
    const outOfBand = base > bandMax

    const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })
    const requireApproval = settings?.requireOfferApproval ?? true

    const offerBid = await bizId.offer()
    const approvalBid = requireApproval ? await bizId.approval() : null

    const offer = await prisma.$transaction(async (tx) => {
      const o = await tx.offer.create({
        data: {
          businessId: offerBid, applicationId: application.id,
          base, bonusPct, bandMin, bandMax, outOfBand,
          status: requireApproval ? 'PendingApproval' : 'Approved',
        },
        include: offerInclude,
      })
      if (requireApproval && approvalBid) {
        await tx.approval.create({
          data: {
            businessId: approvalBid, subjectType: 'Offer', subjectId: o.id,
            subjectLabel: `${application.candidate.name} — ${application.requisition.title}`,
            requestedById: req.user!.id,
          },
        })
      }
      return o
    })

    await audit(req.user!.id, 'Created offer', 'Offer', offer.id, undefined, {
      businessId: offer.businessId, base, outOfBand,
    })
    res.status(201).json(offerToDto(offer))
  } catch (e) { next(e) }
})

/** PATCH /offers/:id/send — mark offer as Sent (must be Approved) */
router.patch('/:id/send', requireRoles('Admin', 'Recruiter', 'HiringManager'), async (req, res, next) => {
  try {
    const id = req.params.id as string
    const offer = await prisma.offer.findFirst({
      where: { OR: [{ businessId: id }, { id }] },
      include: offerInclude,
    })
    if (!offer) throw new AppError(404, 'Offer not found.', 'NOT_FOUND')
    if (offer.status !== 'Approved') throw new AppError(422, 'Only Approved offers can be sent.', 'OFFER_NOT_APPROVED')
    const updated = await prisma.offer.update({ where: { id: offer.id }, data: { status: 'Sent' }, include: offerInclude })
    await audit(req.user!.id, 'Sent offer', 'Offer', offer.id, { status: 'Approved' }, { status: 'Sent' })
    res.json(offerToDto(updated))
  } catch (e) { next(e) }
})

export default router
