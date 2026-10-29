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

function toDto(a: {
  businessId: string; subjectType: string; subjectLabel: string; status: string;
  reason: string | null; createdAt: Date; decidedAt: Date | null;
  requester: { name: string }; approver: { name: string } | null;
}) {
  return {
    id: a.businessId, type: a.subjectType, subject: a.subjectLabel, status: a.status,
    reason: a.reason, requestedBy: a.requester.name, approver: a.approver?.name ?? null,
    createdAt: a.createdAt.toISOString(), decidedAt: a.decidedAt?.toISOString() ?? null,
  }
}

const include = {
  requester: { select: { name: true } },
  approver: { select: { name: true } },
} as const

/** GET /approvals */
router.get('/', async (req, res, next) => {
  try {
    const p = paginationSchema.parse(req.query)
    const { status, type } = req.query as Record<string, string | undefined>
    const where = {
      ...(status ? { status: status as never } : {}),
      ...(type ? { subjectType: type as never } : {}),
    }
    const [data, total] = await prisma.$transaction([
      prisma.approval.findMany({ where, include, orderBy: { createdAt: p.sortDir }, ...paginate(p) }),
      prisma.approval.count({ where }),
    ])
    res.json(paginatedResponse(data.map(toDto), total, p))
  } catch (e) { next(e) }
})

const decideSchema = z.object({
  decision: z.enum(['Approved', 'Rejected']),
  reason: z.string().max(500).optional().default(''),
})

/** POST /approvals/:id/decision
 * Business rules:
 *  - Only Approver or Admin role
 *  - Cannot approve own request (self-approval prevention)
 *  - Cascades: updates requisition or offer status
 */
router.post('/:id/decision', requireRoles('Admin', 'Approver'), validateBody(decideSchema), async (req, res, next) => {
  try {
    const { decision, reason } = req.body as z.infer<typeof decideSchema>
    const id = req.params.id as string
    const isIdUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    const approval = await prisma.approval.findFirst({
      where: isIdUuid ? { OR: [{ businessId: id }, { id }] } : { businessId: id },
      include: { requester: { select: { id: true, name: true } } },
    })
    if (!approval) throw new AppError(404, 'Approval not found.', 'NOT_FOUND')
    if (approval.status !== 'Pending') throw new AppError(422, 'This approval has already been decided.', 'ALREADY_DECIDED')

    // Self-approval prevention
    if (approval.requestedById === req.user!.id) {
      throw new AppError(422, 'You cannot approve your own request.', 'SELF_APPROVAL')
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.approval.update({
        where: { id: approval.id },
        data: {
          status: decision, reason: reason || null,
          approverId: req.user!.id, decidedAt: new Date(),
        },
        include,
      })

      // Cascade status update
      if (approval.subjectType === 'Requisition') {
        await tx.requisition.update({
          where: { id: approval.subjectId },
          data: { status: decision === 'Approved' ? 'Open' : 'Rejected' },
        })
      } else if (approval.subjectType === 'Offer') {
        await tx.offer.update({
          where: { id: approval.subjectId },
          data: { status: decision === 'Approved' ? 'Approved' : 'Rejected' },
        })
      }
      return u
    })

    await audit(req.user!.id, `${decision} ${approval.subjectType.toLowerCase()} approval`, 'Approval', approval.id,
      { status: 'Pending' }, { status: decision, reason })
    res.json(toDto(updated))
  } catch (e) { next(e) }
})

export default router
