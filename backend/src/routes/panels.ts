import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { authenticate, hydrateUser, requireRoles } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { AppError } from '../middleware/errorHandler'
import { bizId } from '../bizId'
import { audit } from '../services/audit'

const router = Router()
router.use(['/interviewers', '/panels'], authenticate, hydrateUser)

// ── Interviewers ─────────────────────────────────────────────────────────────

function ivrToDto(i: {
  businessId?: string; user: { businessId: string; name: string }; team: string;
  availability: { dayOfWeek: number; block: number; free: boolean }[];
}) {
  // availability as [day][block] = boolean (5 days × 3 blocks)
  const avail: boolean[][] = Array.from({ length: 5 }, (_, d) =>
    Array.from({ length: 3 }, (_, b) => i.availability.find((a) => a.dayOfWeek === d && a.block === b)?.free ?? false),
  )
  return {
    id: i.user.businessId, name: i.user.name, team: i.team, availability: avail,
  }
}

/** GET /interviewers */
router.get('/interviewers', async (_req, res, next) => {
  try {
    const ivrs = await prisma.interviewer.findMany({
      include: { user: { select: { businessId: true, name: true } }, availability: true },
      orderBy: { user: { name: 'asc' } },
    })
    res.json(ivrs.map(ivrToDto))
  } catch (e) { next(e) }
})

const toggleSlotSchema = z.object({
  day: z.number().int().min(0).max(4),
  block: z.number().int().min(0).max(2),
  free: z.boolean(),
})

/** PATCH /interviewers/:id/availability */
router.patch('/interviewers/:id/availability', requireRoles('Admin', 'Interviewer'), validateBody(toggleSlotSchema), async (req, res, next) => {
  try {
    const { day, block, free } = req.body as z.infer<typeof toggleSlotSchema>
    const id = req.params.id as string
    const ivr = await prisma.interviewer.findFirst({
      where: { OR: [{ user: { businessId: id } }, { userId: id }, { id }] },
      include: { user: { select: { businessId: true, name: true } }, availability: true },
    })
    if (!ivr) throw new AppError(404, 'Interviewer not found.', 'NOT_FOUND')
    await prisma.availability.upsert({
      where: { interviewerId_dayOfWeek_block: { interviewerId: ivr.id, dayOfWeek: day, block } },
      update: { free },
      create: { interviewerId: ivr.id, dayOfWeek: day, block, free },
    })
    const updated = await prisma.interviewer.findUnique({ where: { id: ivr.id }, include: { user: { select: { businessId: true, name: true } }, availability: true } })
    await audit(req.user!.id, 'Updated availability', 'Interviewer', ivr.id, undefined, { day, block, free })
    res.json(ivrToDto(updated!))
  } catch (e) { next(e) }
})

// ── Panels ────────────────────────────────────────────────────────────────────

function panelToDto(p: {
  businessId: string; name: string; focus: string | null;
  members: { interviewer: { user: { name: string } } }[];
}) {
  return {
    id: p.businessId, name: p.name, focus: p.focus ?? '',
    members: p.members.map((m) => m.interviewer.user.name),
  }
}

const panelInclude = {
  members: { include: { interviewer: { include: { user: { select: { name: true } } } } } },
} as const

/** GET /panels */
router.get('/panels', async (_req, res, next) => {
  try {
    const panels = await prisma.interviewPanel.findMany({ include: panelInclude, orderBy: { name: 'asc' } })
    res.json(panels.map(panelToDto))
  } catch (e) { next(e) }
})

/** GET /panels/:id */
router.get('/panels/:id', async (req, res, next) => {
  try {
    const p = await prisma.interviewPanel.findUnique({ where: { businessId: req.params.id }, include: panelInclude })
    if (!p) throw new AppError(404, 'Panel not found.', 'NOT_FOUND')
    res.json(panelToDto(p))
  } catch (e) { next(e) }
})

const createPanelSchema = z.object({
  name: z.string().min(2).max(200),
  focus: z.string().max(300).optional(),
  members: z.array(z.string()).min(1, 'Panel must have at least one member'),
})

/** POST /panels */
router.post('/panels', requireRoles('Admin', 'Recruiter'), validateBody(createPanelSchema), async (req, res, next) => {
  try {
    const { name, focus, members } = req.body as z.infer<typeof createPanelSchema>
    const ivrs = await prisma.interviewer.findMany({
      where: { user: { businessId: { in: members } } }, select: { id: true },
    })
    if (ivrs.length !== members.length) throw new AppError(404, 'One or more interviewers not found.', 'NOT_FOUND')
    const bid = await bizId.panel()
    const p = await prisma.interviewPanel.create({
      data: { businessId: bid, name, focus, members: { create: ivrs.map((i) => ({ interviewerId: i.id })) } },
      include: panelInclude,
    })
    await audit(req.user!.id, 'Created panel', 'InterviewPanel', p.id, undefined, { businessId: p.businessId })
    res.status(201).json(panelToDto(p))
  } catch (e) { next(e) }
})

/** PATCH /panels/:id */
const updatePanelSchema = createPanelSchema.partial()
router.patch('/panels/:id', requireRoles('Admin', 'Recruiter'), validateBody(updatePanelSchema), async (req, res, next) => {
  try {
    const id = req.params.id as string
    const body = req.body as z.infer<typeof updatePanelSchema>
    const p = await prisma.interviewPanel.findFirst({ where: { OR: [{ businessId: id }, { id }] } })
    if (!p) throw new AppError(404, 'Panel not found.', 'NOT_FOUND')
    const updated = await prisma.interviewPanel.update({
      where: { id: p.id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.focus !== undefined ? { focus: body.focus } : {}),
      },
      include: panelInclude,
    })
    await audit(req.user!.id, 'Updated panel', 'InterviewPanel', p.id, undefined, body)
    res.json(panelToDto(updated))
  } catch (e) { next(e) }
})

/** DELETE /panels/:id/members/:memberId */
router.delete('/panels/:id/members/:memberId', requireRoles('Admin', 'Recruiter'), async (req, res, next) => {
  try {
    const id = req.params.id as string
    const memberId = req.params.memberId as string
    const p = await prisma.interviewPanel.findFirst({ where: { OR: [{ businessId: id }, { id }] } })
    if (!p) throw new AppError(404, 'Panel not found.', 'NOT_FOUND')
    const ivr = await prisma.interviewer.findFirst({
      where: {
        OR: [
          { user: { businessId: memberId } },
          { user: { name: memberId } },
          { id: memberId },
        ],
      },
    })
    if (!ivr) throw new AppError(404, 'Interviewer not found.', 'NOT_FOUND')
    await prisma.interviewPanelMember.deleteMany({ where: { panelId: p.id, interviewerId: ivr.id } })
    const updated = await prisma.interviewPanel.findUnique({ where: { id: p.id }, include: panelInclude })
    await audit(req.user!.id, 'Removed panel member', 'InterviewPanel', p.id, undefined, { memberId })
    res.json(panelToDto(updated!))
  } catch (e) { next(e) }
})

/** POST /panels/:id/members — add member */
router.post('/panels/:id/members', requireRoles('Admin', 'Recruiter'), validateBody(z.object({ interviewerBusinessId: z.string() })), async (req, res, next) => {
  try {
    const id = req.params.id as string
    const p = await prisma.interviewPanel.findFirst({ where: { OR: [{ businessId: id }, { id }] } })
    if (!p) throw new AppError(404, 'Panel not found.', 'NOT_FOUND')
    const ivr = await prisma.interviewer.findFirst({ where: { user: { businessId: req.body.interviewerBusinessId } } })
    if (!ivr) throw new AppError(404, 'Interviewer not found.', 'NOT_FOUND')
    await prisma.interviewPanelMember.upsert({
      where: { panelId_interviewerId: { panelId: p.id, interviewerId: ivr.id } },
      update: {}, create: { panelId: p.id, interviewerId: ivr.id },
    })
    const updated = await prisma.interviewPanel.findUnique({ where: { id: p.id }, include: panelInclude })
    res.json(panelToDto(updated!))
  } catch (e) { next(e) }
})

export default router
