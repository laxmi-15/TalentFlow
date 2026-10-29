import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { authenticate, hydrateUser, requireRoles } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { AppError } from '../middleware/errorHandler'
import { audit } from '../services/audit'

const router = Router()
router.use(authenticate, hydrateUser)

const userSelect = {
  businessId: true, name: true, email: true, role: true, active: true,
} as const

function toDto(u: { businessId: string; name: string; email: string; role: string; active: boolean }) {
  return { id: u.businessId, name: u.name, email: u.email, role: u.role === 'HiringManager' ? 'Hiring Manager' : u.role, active: u.active }
}

/** GET /users — list all users (Admin only) */
router.get('/', requireRoles('Admin'), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({ select: userSelect, orderBy: { name: 'asc' } })
    res.json(users.map(toDto))
  } catch (e) { next(e) }
})

const patchRoleSchema = z.object({
  role: z.enum(['Admin', 'Recruiter', 'HiringManager', 'Hiring Manager', 'Interviewer', 'Approver']).transform((r) => r === 'Hiring Manager' ? 'HiringManager' : r),
})

/** PATCH /users/:id — change role (Admin only) */
router.patch('/:id', requireRoles('Admin'), validateBody(patchRoleSchema), async (req, res, next) => {
  try {
    const { role } = req.body as z.infer<typeof patchRoleSchema>
    const id = req.params.id as string
    const target = await prisma.user.findFirst({ where: { OR: [{ businessId: id }, { id }] } })
    if (!target) throw new AppError(404, 'User not found.', 'NOT_FOUND')
    const before = { role: target.role }
    const updated = await prisma.user.update({ where: { id: target.id }, data: { role }, select: userSelect })
    await audit(req.user!.id, 'Changed role', 'User', target.id, before, { role })
    res.json(toDto(updated))
  } catch (e) { next(e) }
})

/** GET /settings */
router.get('/settings', async (_req, res, next) => {
  try {
    let settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })
    if (!settings) {
      settings = await prisma.settings.create({
        data: { id: 'singleton', orgName: 'TalentFlow Org', timezone: 'UTC', requireOfferApproval: true },
      })
    }
    res.json({ orgName: settings.orgName, timezone: settings.timezone, requireOfferApproval: settings.requireOfferApproval })
  } catch (e) { next(e) }
})

const settingsSchema = z.object({
  orgName: z.string().min(1).max(200),
  timezone: z.string().min(1).max(100),
  requireOfferApproval: z.boolean(),
})

/** PUT /settings (Admin only) */
router.put('/settings', requireRoles('Admin'), validateBody(settingsSchema), async (req, res, next) => {
  try {
    const data = req.body as z.infer<typeof settingsSchema>
    const settings = await prisma.settings.upsert({
      where: { id: 'singleton' },
      update: data,
      create: { id: 'singleton', ...data },
    })
    await audit(req.user!.id, 'Updated settings', 'Settings', 'singleton', undefined, data)
    res.json({ orgName: settings.orgName, timezone: settings.timezone, requireOfferApproval: settings.requireOfferApproval })
  } catch (e) { next(e) }
})

export default router
