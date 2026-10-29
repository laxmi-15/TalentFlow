import { Router } from 'express'
import { prisma } from '../db'
import { authenticate, hydrateUser } from '../middleware/auth'
import { paginationSchema, paginate, paginatedResponse } from '../utils/pagination'

const router = Router()
router.use(authenticate, hydrateUser)

/** GET /audit-events */
router.get('/', async (req, res, next) => {
  try {
    const p = paginationSchema.parse(req.query)
    const { entityType, actorId } = req.query as Record<string, string | undefined>
    const where = {
      ...(entityType ? { entityType } : {}),
      ...(actorId ? { actor: { businessId: actorId } } : {}),
    }
    const [data, total] = await prisma.$transaction([
      prisma.auditEvent.findMany({
        where,
        include: { actor: { select: { businessId: true, name: true } } },
        orderBy: { createdAt: p.sortDir },
        ...paginate(p),
      }),
      prisma.auditEvent.count({ where }),
    ])
    res.json(paginatedResponse(
      data.map((e) => ({
        id: e.businessId, actor: e.actor.name, action: e.action,
        entity: e.entityType, entityId: e.entityId,
        at: e.createdAt.toISOString(),
      })),
      total, p,
    ))
  } catch (e) { next(e) }
})

export default router
