import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { authenticate, hydrateUser, requireRoles } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { audit } from '../services/audit'
import { bizId } from '../bizId'
import { paginationSchema, paginate, paginatedResponse } from '../utils/pagination'

const router = Router()
router.use(authenticate, hydrateUser)

function runToDto(r: {
  businessId: string; seed: bigint; profile: string; generatorVersion: string;
  status: string; checksumSha256: string | null; rowCounts: unknown; createdAt: Date; completedAt: Date | null;
  validationResults: { checkName: string; passed: number | null; total: number | null; isAnomaly: boolean; detected: boolean }[];
}) {
  const checks = r.validationResults.map((v) => ({
    name: v.checkName,
    passed: v.passed ?? 0,
    total: v.total ?? 0,
  }))
  return {
    id: r.businessId, seed: Number(r.seed), profile: r.profile,
    generatorVersion: r.generatorVersion, status: r.status,
    checksum: r.checksumSha256, rowCounts: r.rowCounts,
    rows: checks.reduce((s, c) => Math.max(s, c.total), 0),
    generatedAt: r.createdAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
    checks,
  }
}

/** GET /data-quality/reports */
router.get('/reports', async (req, res, next) => {
  try {
    const p = paginationSchema.parse(req.query)
    const [data, total] = await prisma.$transaction([
      prisma.generationRun.findMany({
        include: { validationResults: { select: { checkName: true, passed: true, total: true, isAnomaly: true, detected: true } } },
        orderBy: { createdAt: p.sortDir }, ...paginate(p),
      }),
      prisma.generationRun.count(),
    ])
    res.json(paginatedResponse(data.map(runToDto), total, p))
  } catch (e) { next(e) }
})

const generateSchema = z.object({
  seed: z.number().int().default(20261022),
  profile: z.enum(['starter', 'full']).default('starter'),
  rows: z.number().int().min(10).max(10000).default(500),
})

/** POST /data-quality/reports — kick off a generation run record (Python engine does the work) */
router.post('/reports', requireRoles('Admin'), validateBody(generateSchema), async (req, res, next) => {
  try {
    const { seed, profile, rows } = req.body as z.infer<typeof generateSchema>
    const bid = await bizId.generation()
    const run = await prisma.generationRun.create({
      data: {
        businessId: bid, seed, profile, generatorVersion: '1.0.0',
        status: 'Pending', rowCounts: { requested: rows },
      },
      include: { validationResults: true },
    })
    await audit(req.user!.id, 'Created generation run', 'GenerationRun', run.id, undefined, { businessId: run.businessId, seed, profile })
    res.status(201).json(runToDto(run))
  } catch (e) { next(e) }
})

/** GET /data-quality/reports/:id */
router.get('/reports/:id', async (req, res, next) => {
  try {
    const run = await prisma.generationRun.findUnique({
      where: { businessId: req.params.id },
      include: { validationResults: { select: { checkName: true, passed: true, total: true, isAnomaly: true, detected: true } } },
    })
    if (!run) {
      res.status(404).json({ message: 'Generation run not found.', code: 'NOT_FOUND' })
      return
    }
    res.json(runToDto(run))
  } catch (e) { next(e) }
})

/** GET /validation/results — anomaly detection results with TP/FP/FN */
router.get('/validation/results', async (req, res, next) => {
  try {
    const p = paginationSchema.parse(req.query)
    const { runId } = req.query as Record<string, string | undefined>
    const where = runId ? { generationRun: { businessId: runId } } : {}
    const [results, total] = await prisma.$transaction([
      prisma.validationResult.findMany({
        where, include: { generationRun: { select: { businessId: true } } },
        orderBy: { createdAt: 'desc' }, ...paginate(p),
      }),
      prisma.validationResult.count({ where }),
    ])
    // Compute aggregate precision/recall
    const anomalies = results.filter((r) => r.isAnomaly)
    const tp = anomalies.filter((r) => r.detected).length
    const fn = anomalies.filter((r) => !r.detected).length
    const fp = results.filter((r) => !r.isAnomaly && r.detected).length
    const precision = tp + fp > 0 ? tp / (tp + fp) : null
    const recall = tp + fn > 0 ? tp / (tp + fn) : null

    res.json(paginatedResponse(results.map((r) => ({
      id: r.id, checkName: r.checkName, issueType: r.issueType,
      affectedRecordId: r.affectedRecordId, expectedDecision: r.expectedDecision,
      severity: r.severity, isAnomaly: r.isAnomaly, detected: r.detected,
      tp: r.tp, fp: r.fp, fn: r.fn,
      runId: r.generationRun?.businessId ?? null,
    })), total, p),
    )
    // Append metrics as a separate field on the response
    // We extend the response with metrics in the wrapper
    const base = { data: results, meta: { total, page: p.page, pageSize: p.pageSize, totalPages: Math.ceil(total / p.pageSize) } }
    res.json({ ...base, metrics: { tp, fp, fn, precision, recall } })
  } catch (e) { next(e) }
})

export default router
