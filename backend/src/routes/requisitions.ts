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

function toDto(r: {
  businessId: string; title: string; department: string; location: string;
  hiringManager: { user: { name: string } }; headcount: number; status: string;
  bandMin: unknown; bandMax: unknown; createdAt: Date; skillRequirements?: { skill: string; required: boolean; minYears: number | null }[]
}) {
  return {
    id: r.businessId, title: r.title, department: r.department, location: r.location,
    hiringManager: r.hiringManager.user.name,
    headcount: r.headcount,
    status: r.status === 'PendingApproval' ? 'Pending approval' : r.status,
    bandMin: Number(r.bandMin), bandMax: Number(r.bandMax),
    createdAt: r.createdAt.toISOString(),
    skillRequirements: r.skillRequirements?.map((s) => ({ skill: s.skill, required: s.required, minYears: s.minYears })),
  }
}

const reqInclude = {
  hiringManager: { include: { user: { select: { name: true } } } },
  skillRequirements: { select: { skill: true, required: true, minYears: true } },
} as const

/** GET /requisitions */
router.get('/', async (req, res, next) => {
  try {
    const p = paginationSchema.parse(req.query)
    const { status, department } = req.query as Record<string, string | undefined>
    const where = {
      ...(status ? { status: status as never } : {}),
      ...(department ? { department: { contains: department, mode: 'insensitive' as const } } : {}),
    }
    const [data, total] = await prisma.$transaction([
      prisma.requisition.findMany({
        where, include: reqInclude, orderBy: { createdAt: p.sortDir }, ...paginate(p),
      }),
      prisma.requisition.count({ where }),
    ])
    res.json(paginatedResponse(data.map(toDto), total, p))
  } catch (e) { next(e) }
})

/** GET /requisitions/:id */
router.get('/:id', async (req, res, next) => {
  try {
    const r = await prisma.requisition.findUnique({ where: { businessId: req.params.id }, include: reqInclude })
    if (!r) throw new AppError(404, 'Requisition not found.', 'NOT_FOUND')
    res.json(toDto(r))
  } catch (e) { next(e) }
})

const createSchema = z.object({
  title: z.string().min(2).max(200),
  department: z.string().min(1).max(100),
  location: z.string().min(1).max(100),
  hiringManagerBusinessId: z.string().min(1),
  headcount: z.number().int().min(1),
  bandMin: z.number().positive(),
  bandMax: z.number().positive(),
  skillRequirements: z.array(z.object({ skill: z.string().min(1), required: z.boolean().default(true), minYears: z.number().int().min(0).optional() })).optional(),
})

/** POST /requisitions — creates in Draft status */
router.post('/', requireRoles('Admin', 'Recruiter', 'HiringManager'), validateBody(createSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof createSchema>
    if (body.bandMax < body.bandMin) throw new AppError(400, 'bandMax must be ≥ bandMin.', 'INVALID_BAND')
    const hm = await prisma.hiringManager.findFirst({ where: { user: { businessId: body.hiringManagerBusinessId } } })
    if (!hm) throw new AppError(404, 'Hiring manager not found.', 'NOT_FOUND')
    const bid = await bizId.requisition()
    const r = await prisma.requisition.create({
      data: {
        businessId: bid, title: body.title, department: body.department, location: body.location,
        hiringManagerId: hm.id, headcount: body.headcount, status: 'Draft',
        bandMin: body.bandMin, bandMax: body.bandMax,
        skillRequirements: body.skillRequirements ? { create: body.skillRequirements } : undefined,
      },
      include: reqInclude,
    })
    await audit(req.user!.id, 'Created requisition', 'Requisition', r.id, undefined, { businessId: r.businessId })
    res.status(201).json(toDto(r))
  } catch (e) { next(e) }
})

/** PATCH /requisitions/:id — update (Draft only) */
const updateSchema = createSchema.partial()
router.patch('/:id', requireRoles('Admin', 'Recruiter', 'HiringManager'), validateBody(updateSchema), async (req, res, next) => {
  try {
    const id = req.params.id as string
    const r = await prisma.requisition.findFirst({ where: { OR: [{ businessId: id }, { id }] } })
    if (!r) throw new AppError(404, 'Requisition not found.', 'NOT_FOUND')
    if (r.status !== 'Draft') throw new AppError(422, 'Only Draft requisitions can be edited.', 'INVALID_STATUS')
    const body = req.body as z.infer<typeof updateSchema>
    const updated = await prisma.requisition.update({
      where: { id: r.id },
      data: {
        ...(body.title ? { title: body.title } : {}),
        ...(body.department ? { department: body.department } : {}),
        ...(body.location ? { location: body.location } : {}),
        ...(body.headcount ? { headcount: body.headcount } : {}),
        ...(body.bandMin !== undefined ? { bandMin: body.bandMin } : {}),
        ...(body.bandMax !== undefined ? { bandMax: body.bandMax } : {}),
      },
      include: reqInclude,
    })
    await audit(req.user!.id, 'Updated requisition', 'Requisition', r.id, r, updated)
    res.json(toDto(updated))
  } catch (e) { next(e) }
})

/** PATCH /requisitions/:id/submit — Draft → PendingApproval + creates Approval */
router.patch('/:id/submit', requireRoles('Admin', 'Recruiter', 'HiringManager'), async (req, res, next) => {
  try {
    const id = req.params.id as string
    const r = await prisma.requisition.findFirst({ where: { OR: [{ businessId: id }, { id }] }, include: reqInclude })
    if (!r) throw new AppError(404, 'Requisition not found.', 'NOT_FOUND')
    if (r.status !== 'Draft') throw new AppError(422, 'Only Draft requisitions can be submitted.', 'INVALID_STATUS')
    const approvalBid = await bizId.approval()
    const [updated] = await prisma.$transaction([
      prisma.requisition.update({ where: { id: r.id }, data: { status: 'PendingApproval' }, include: reqInclude }),
      prisma.approval.create({
        data: {
          businessId: approvalBid, subjectType: 'Requisition', subjectId: r.id,
          subjectLabel: `${r.businessId} — ${r.title}`, requestedById: req.user!.id,
        },
      }),
    ])
    await audit(req.user!.id, 'Submitted requisition for approval', 'Requisition', r.id, { status: 'Draft' }, { status: 'PendingApproval' })
    res.json(toDto(updated))
  } catch (e) { next(e) }
})

export default router
