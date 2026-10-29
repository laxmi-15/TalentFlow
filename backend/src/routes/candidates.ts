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

function toDto(c: {
  businessId: string
  name: string
  email: string
  phone: string | null
  location: string
  source: string
  experienceYears: number
  skills: string[]
  createdAt: Date
  applications?: {
    businessId: string
    stage: string
    requisition: { businessId: string; title: string }
  }[]
}) {
  const role = c.applications?.[0]?.requisition?.title ?? 'General Candidate'
  return {
    id: c.businessId,
    name: c.name,
    email: c.email,
    phone: c.phone,
    role,
    location: c.location,
    source: c.source === 'CareerssSite' ? 'Careers Site' : c.source,
    experienceYears: c.experienceYears,
    skills: c.skills,
    createdAt: c.createdAt.toISOString(),
    applications: c.applications?.map((a) => ({
      id: a.businessId,
      stage: a.stage,
      requisitionId: a.requisition.businessId,
      requisitionTitle: a.requisition.title,
    })),
  }
}

/** GET /candidates */
router.get('/', async (req, res, next) => {
  try {
    const p = paginationSchema.parse(req.query)
    const { search, source, location } = req.query as Record<string, string | undefined>
    const dbSource = source === 'Careers Site' ? 'CareerssSite' : source
    const where = {
      ...(dbSource ? { source: dbSource as never } : {}),
      ...(location ? { location: { contains: location, mode: 'insensitive' as const } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }
    const [data, total] = await prisma.$transaction([
      prisma.candidate.findMany({
        where,
        orderBy: { createdAt: p.sortDir },
        include: {
          applications: {
            include: { requisition: { select: { businessId: true, title: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
        ...paginate(p),
      }),
      prisma.candidate.count({ where }),
    ])
    res.json(paginatedResponse(data.map(toDto), total, p))
  } catch (e) {
    next(e)
  }
})

/** GET /candidates/:id — with applications */
router.get('/:id', async (req, res, next) => {
  try {
    const c = await prisma.candidate.findUnique({
      where: { businessId: req.params.id },
      include: {
        applications: {
          include: { requisition: { select: { businessId: true, title: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    })
    if (!c) throw new AppError(404, 'Candidate not found.', 'NOT_FOUND')
    res.json(toDto(c))
  } catch (e) {
    next(e) }
})

const createSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(200),
  email: z.string().trim().email('Please enter a valid email address.').max(300),
  phone: z.string().trim().max(30).optional().nullable(),
  location: z.string().trim().min(1, 'Location is required.').max(100),
  source: z
    .enum(['Referral', 'CareerssSite', 'Careers Site', 'Agency', 'JobBoard', 'Campus'])
    .transform((s) => (s === 'Careers Site' ? 'CareerssSite' : s)),
  experienceYears: z.coerce.number().int().min(0, 'Experience cannot be negative.').max(50),
  skills: z
    .union([z.array(z.string()), z.string()])
    .transform((s) =>
      Array.isArray(s)
        ? s.map((x) => x.trim()).filter(Boolean)
        : s.split(',').map((x) => x.trim()).filter(Boolean),
    )
    .default([]),
  targetRole: z.string().trim().optional().nullable(),
  requisitionId: z.string().trim().optional().nullable(),
})

/** POST /candidates */
router.post('/', requireRoles('Admin', 'Recruiter'), validateBody(createSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof createSchema>
    const normalizedEmail = body.email.toLowerCase().trim()

    // 1. Check for duplicate email
    const existing = await prisma.candidate.findUnique({
      where: { email: normalizedEmail },
    })
    if (existing) {
      throw new AppError(409, 'A candidate with this email address already exists.', 'DUPLICATE_EMAIL')
    }

    // 2. Generate business ID and create candidate
    const bid = await bizId.candidate()
    const { targetRole, requisitionId, ...candidateData } = body

    const c = await prisma.candidate.create({
      data: {
        businessId: bid,
        name: candidateData.name.trim(),
        email: normalizedEmail,
        phone: candidateData.phone?.trim() || null,
        location: candidateData.location.trim(),
        source: candidateData.source as any,
        experienceYears: candidateData.experienceYears,
        skills: candidateData.skills,
      },
    })

    // 3. If target role or requisition specified, link to requisition
    const roleTarget = (requisitionId || targetRole || '').trim()
    if (roleTarget) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roleTarget)
      const reqRecord = await prisma.requisition.findFirst({
        where: {
          OR: [
            ...(isUuid ? [{ id: roleTarget }] : []),
            { businessId: roleTarget },
            { title: { equals: roleTarget, mode: 'insensitive' as const } },
          ],
        },
      })
      if (reqRecord) {
        const appBid = await bizId.application(c.businessId, reqRecord.businessId)
        await prisma.application.create({
          data: {
            businessId: appBid,
            candidateId: c.id,
            requisitionId: reqRecord.id,
            stage: 'Applied',
            source: c.source,
            stageEvents: {
              create: [
                {
                  fromStage: null,
                  toStage: 'Applied',
                  actorId: req.user!.id,
                  reason: 'Application created via Add Candidate',
                },
              ],
            },
          },
        })
      }
    }

    await audit(req.user!.id, 'Created candidate', 'Candidate', c.id, undefined, {
      businessId: c.businessId,
      name: c.name,
      email: c.email,
    })

    // 4. Return candidate DTO with any created applications
    const fullCandidate = await prisma.candidate.findUnique({
      where: { id: c.id },
      include: {
        applications: {
          include: { requisition: { select: { businessId: true, title: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    res.status(201).json(toDto(fullCandidate!))
  } catch (e) {
    next(e)
  }
})

export default router
