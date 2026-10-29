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

function intToDto(i: {
  businessId: string; title: string; startAt: Date; endAt: Date; status: string;
  cancelReason: string | null; originalStartAt: Date | null; createdAt: Date; updatedAt: Date;
  application: { businessId: string; candidate: { name: string } };
  panel: { businessId: string; name: string };
  interviewers: { interviewer: { user: { businessId: string; name: string } } }[];
}) {
  return {
    id: i.businessId, title: i.title, status: i.status,
    start: i.startAt.toISOString(), end: i.endAt.toISOString(),
    cancelReason: i.cancelReason, originalStart: i.originalStartAt?.toISOString() ?? null,
    applicationId: i.application.businessId, candidateName: i.application.candidate.name,
    panelId: i.panel.businessId, panelName: i.panel.name,
    panel: i.interviewers.map((x) => x.interviewer.user.name),
    createdAt: i.createdAt.toISOString(), updatedAt: i.updatedAt.toISOString(),
  }
}

const intInclude = {
  application: { include: { candidate: { select: { name: true } } } },
  panel: { select: { businessId: true, name: true } },
  interviewers: { include: { interviewer: { include: { user: { select: { businessId: true, name: true } } } } } },
} as const

/** GET /interviews */
router.get('/', async (req, res, next) => {
  try {
    const p = paginationSchema.parse(req.query)
    const { status, applicationId } = req.query as Record<string, string | undefined>
    const where = {
      ...(status ? { status: status as never } : {}),
      ...(applicationId ? { application: { businessId: applicationId } } : {}),
    }
    const [data, total] = await prisma.$transaction([
      prisma.interview.findMany({ where, include: intInclude, orderBy: { startAt: p.sortDir }, ...paginate(p) }),
      prisma.interview.count({ where }),
    ])
    res.json(paginatedResponse(data.map(intToDto), total, p))
  } catch (e) { next(e) }
})

/** GET /interviews/:id */
router.get('/:id', async (req, res, next) => {
  try {
    const i = await prisma.interview.findUnique({ where: { businessId: req.params.id }, include: intInclude })
    if (!i) throw new AppError(404, 'Interview not found.', 'NOT_FOUND')
    res.json(intToDto(i))
  } catch (e) { next(e) }
})

const scheduleSchema = z
  .object({
    applicationBusinessId: z.string().min(1).optional(),
    applicationId: z.string().min(1).optional(),
    panelBusinessId: z.string().min(1).optional(),
    panelId: z.string().min(1).optional(),
    start: z.string().min(1),
    durationMin: z.coerce.number().int().min(15).max(480),
  })
  .transform((d) => {
    const appId = d.applicationBusinessId || d.applicationId
    const pnlId = d.panelBusinessId || d.panelId
    if (!appId) throw new Error('applicationId or applicationBusinessId is required.')
    if (!pnlId) throw new Error('panelId or panelBusinessId is required.')
    const dt = new Date(d.start)
    if (isNaN(dt.getTime())) throw new Error('Invalid start date.')
    return {
      applicationBusinessId: appId,
      panelBusinessId: pnlId,
      start: dt.toISOString(),
      durationMin: d.durationMin,
    }
  })

/**
 * POST /interviews — schedule with conflict prevention
 * Checks:
 *   1. Application is in Screen, Interview or Final stage and not Withdrawn
 *   2. Each panel member is available for the time slot (day+block heuristic)
 *   3. No active overlapping interview for any panel member (app-level check)
 *   4. No active overlapping interview for the candidate
 */
router.post('/', requireRoles('Admin', 'Recruiter', 'HiringManager'), validateBody(scheduleSchema), async (req, res, next) => {
  try {
    const { applicationBusinessId, panelBusinessId, start, durationMin } = req.body as z.infer<typeof scheduleSchema>
    const startAt = new Date(start)
    const endAt = new Date(startAt.getTime() + durationMin * 60000)

    const isAppUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(applicationBusinessId)
    const isPnlUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(panelBusinessId)

    const [application, panel] = await Promise.all([
      prisma.application.findFirst({
        where: isAppUuid ? { OR: [{ businessId: applicationBusinessId }, { id: applicationBusinessId }] } : { businessId: applicationBusinessId },
        include: { candidate: true },
      }),
      prisma.interviewPanel.findFirst({
        where: isPnlUuid ? { OR: [{ businessId: panelBusinessId }, { id: panelBusinessId }] } : { businessId: panelBusinessId },
        include: { members: { include: { interviewer: { include: { user: true, availability: true } } } } },
      }),
    ])
    if (!application) throw new AppError(404, 'Application not found.', 'NOT_FOUND')
    if (!panel) throw new AppError(404, 'Panel not found.', 'NOT_FOUND')
    if (!['Screen', 'Interview', 'Final'].includes(application.stage)) {
      throw new AppError(422, `Interview can only be scheduled when application is in Screen, Interview, or Final stage. Current: ${application.stage}.`, 'INVALID_APP_STAGE')
    }
    if (application.stage === 'Withdrawn') {
      throw new AppError(422, 'Cannot schedule interview for a withdrawn application.', 'APP_WITHDRAWN')
    }

    const interviewerIds = panel.members.map((m) => m.interviewer.id)

    // Check interviewer conflicts (application-level, pre-DB-constraint)
    const ivrConflicts = await prisma.interview.findFirst({
      where: {
        status: { in: ['Scheduled', 'Rescheduled'] },
        interviewers: { some: { interviewerId: { in: interviewerIds } } },
        AND: [{ startAt: { lt: endAt } }, { endAt: { gt: startAt } }],
      },
      include: { interviewers: { include: { interviewer: { include: { user: { select: { name: true } } } } } } },
    })
    if (ivrConflicts) {
      const conflicted = ivrConflicts.interviewers
        .filter((x) => interviewerIds.includes(x.interviewerId))
        .map((x) => x.interviewer.user.name)
      throw new AppError(409, `Scheduling conflict: ${conflicted.join(', ')} is already booked during this time.`, 'INTERVIEWER_CONFLICT')
    }

    // Check candidate conflict
    const candConflict = await prisma.interview.findFirst({
      where: {
        applicationId: application.id,
        status: { in: ['Scheduled', 'Rescheduled'] },
        AND: [{ startAt: { lt: endAt } }, { endAt: { gt: startAt } }],
      },
    })
    if (candConflict) {
      throw new AppError(409, 'The candidate already has another interview scheduled during this time.', 'CANDIDATE_CONFLICT')
    }

    const bid = await bizId.interview()
    const interview = await prisma.interview.create({
      data: {
        businessId: bid, applicationId: application.id, panelId: panel.id,
        title: panel.name, startAt, endAt, status: 'Scheduled',
        interviewers: { create: interviewerIds.map((id) => ({ interviewerId: id })) },
      },
      include: intInclude,
    })
    await audit(req.user!.id, 'Scheduled interview', 'Interview', interview.id, undefined, { businessId: interview.businessId })
    res.status(201).json(intToDto(interview))
  } catch (e) { next(e) }
})

const rescheduleSchema = z.object({
  start: z.string().datetime(),
  durationMin: z.number().int().min(15).max(480),
  reason: z.string().max(500).optional(),
})

/** PATCH /interviews/:id — update interview status (e.g. Cancelled) */
router.patch('/:id', requireRoles('Admin', 'Recruiter', 'HiringManager', 'Interviewer'), async (req, res, next) => {
  try {
    const id = req.params.id as string
    const status = req.body?.status as string | undefined
    const reason = req.body?.reason as string | undefined
    const isIdUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    const interview = await prisma.interview.findFirst({
      where: isIdUuid ? { OR: [{ businessId: id }, { id }] } : { businessId: id },
      include: intInclude,
    })
    if (!interview) throw new AppError(404, 'Interview not found.', 'NOT_FOUND')

    if (status === 'Cancelled') {
      const updated = await prisma.interview.update({
        where: { id: interview.id },
        data: { status: 'Cancelled', cancelReason: reason ?? 'Cancelled by user' },
        include: intInclude,
      })
      await audit(req.user!.id, `Cancelled interview: ${reason ?? 'by user'}`, 'Interview', interview.id, { status: interview.status }, { status: 'Cancelled' })
      res.json(intToDto(updated))
      return
    }

    if (status === 'Completed') {
      const updated = await prisma.interview.update({
        where: { id: interview.id },
        data: { status: 'Completed' },
        include: intInclude,
      })
      await audit(req.user!.id, 'Completed interview', 'Interview', interview.id, { status: interview.status }, { status: 'Completed' })
      res.json(intToDto(updated))
      return
    }

    res.json(intToDto(interview))
  } catch (e) { next(e) }
})

/** PATCH /interviews/:id/reschedule */
router.patch('/:id/reschedule', requireRoles('Admin', 'Recruiter', 'HiringManager'), validateBody(rescheduleSchema), async (req, res, next) => {
  try {
    const id = req.params.id as string
    const { start, durationMin, reason } = req.body as z.infer<typeof rescheduleSchema>
    const isIdUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    const interview = await prisma.interview.findFirst({
      where: isIdUuid ? { OR: [{ businessId: id }, { id }] } : { businessId: id },
      include: intInclude,
    })
    if (!interview) throw new AppError(404, 'Interview not found.', 'NOT_FOUND')
    if (!['Scheduled', 'Rescheduled'].includes(interview.status)) {
      throw new AppError(422, 'Only Scheduled or Rescheduled interviews can be rescheduled.', 'INVALID_STATUS')
    }
    const newStart = new Date(start)
    const newEnd = new Date(newStart.getTime() + durationMin * 60000)
    const interviewerIds = interview.interviewers.map((x: any) => x.interviewerId)

    // Conflict check (excluding self)
    const conflict = await prisma.interview.findFirst({
      where: {
        id: { not: interview.id },
        status: { in: ['Scheduled', 'Rescheduled'] },
        interviewers: { some: { interviewerId: { in: interviewerIds } } },
        AND: [{ startAt: { lt: newEnd } }, { endAt: { gt: newStart } }],
      },
    })
    if (conflict) throw new AppError(409, 'Scheduling conflict: one or more interviewers is already booked at the new time.', 'INTERVIEWER_CONFLICT')

    const before = { startAt: interview.startAt, endAt: interview.endAt, status: interview.status }
    const updated = await prisma.interview.update({
      where: { id: interview.id },
      data: {
        startAt: newStart, endAt: newEnd, status: 'Rescheduled',
        originalStartAt: interview.originalStartAt ?? interview.startAt,
      },
      include: intInclude,
    })
    await audit(req.user!.id, reason ? `Rescheduled: ${reason}` : 'Rescheduled interview', 'Interview', interview.id, before, { startAt: newStart, endAt: newEnd })
    res.json(intToDto(updated))
  } catch (e) { next(e) }
})

const cancelSchema = z.object({ reason: z.string().min(1).max(500) })

/** PATCH /interviews/:id/cancel */
router.patch('/:id/cancel', requireRoles('Admin', 'Recruiter', 'HiringManager'), validateBody(cancelSchema), async (req, res, next) => {
  try {
    const id = req.params.id as string
    const { reason } = req.body as z.infer<typeof cancelSchema>
    const isIdUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    const interview = await prisma.interview.findFirst({
      where: isIdUuid ? { OR: [{ businessId: id }, { id }] } : { businessId: id },
      include: intInclude,
    })
    if (!interview) throw new AppError(404, 'Interview not found.', 'NOT_FOUND')
    if (!['Scheduled', 'Rescheduled'].includes(interview.status)) {
      throw new AppError(422, 'Only Scheduled or Rescheduled interviews can be cancelled.', 'INVALID_STATUS')
    }
    const updated = await prisma.interview.update({
      where: { id: interview.id },
      data: { status: 'Cancelled', cancelReason: reason },
      include: intInclude,
    })
    await audit(req.user!.id, `Cancelled interview: ${reason}`, 'Interview', interview.id, { status: 'Scheduled' }, { status: 'Cancelled', reason })
    res.json(intToDto(updated))
  } catch (e) { next(e) }
})

/** PATCH /interviews/:id/complete */
router.patch('/:id/complete', requireRoles('Admin', 'Recruiter', 'HiringManager', 'Interviewer'), async (req, res, next) => {
  try {
    const id = req.params.id as string
    const isIdUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    const interview = await prisma.interview.findFirst({
      where: isIdUuid ? { OR: [{ businessId: id }, { id }] } : { businessId: id },
      include: intInclude,
    })
    if (!interview) throw new AppError(404, 'Interview not found.', 'NOT_FOUND')
    if (!['Scheduled', 'Rescheduled'].includes(interview.status)) {
      throw new AppError(422, 'Only Scheduled or Rescheduled interviews can be completed.', 'INVALID_STATUS')
    }
    const updated = await prisma.interview.update({
      where: { id: interview.id }, data: { status: 'Completed' }, include: intInclude,
    })
    await audit(req.user!.id, 'Completed interview', 'Interview', interview.id, { status: 'Scheduled' }, { status: 'Completed' })
    res.json(intToDto(updated))
  } catch (e) { next(e) }
})

export default router
