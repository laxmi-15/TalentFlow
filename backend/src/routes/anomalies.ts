import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { authenticate, hydrateUser } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { AppError } from '../middleware/errorHandler'
import { audit } from '../services/audit'
import { paginationSchema, paginate, paginatedResponse } from '../utils/pagination'
import { runAnomalyDetection } from '../services/anomalyDetector'
import { seedEvaluationFixtures } from '../fixtures/evaluationFixtures'

const router = Router()
router.use(authenticate, hydrateUser)

/**
 * Anomalies are detected from live recruitment operations data or injected via evaluation fixtures.
 * The frontend reads them; status updates trigger audit events.
 */

function toDto(a: {
  id: string; issueType: string | null; severity: string | null; status: string;
  affectedRecordId: string | null; expectedDecision: string | null; detected: boolean;
  createdAt: Date;
  generationRun?: { businessId: string } | null;
}) {
  return {
    id: a.id,
    type: a.issueType ?? 'GeneralAnomaly',
    severity: a.severity ?? 'Medium',
    status: a.status,
    subject: a.affectedRecordId ?? a.id,
    detail: a.expectedDecision
      ? `${a.issueType ?? 'Anomaly'}: ${a.expectedDecision} (Subject: ${a.affectedRecordId ?? 'N/A'})`
      : `${a.issueType ?? 'Anomaly'} — record: ${a.affectedRecordId ?? 'N/A'}`,
    detected: a.detected,
    expectedDecision: a.expectedDecision,
    runId: a.generationRun?.businessId ?? null,
    detectedAt: a.createdAt.toISOString(),
  }
}

/** GET /anomalies — runs active detection and returns anomalies */
router.get('/', async (req, res, next) => {
  try {
    const p = paginationSchema.parse(req.query)
    const { status, severity } = req.query as Record<string, string | undefined>

    // Automatically synchronize detection with PostgreSQL state
    try {
      await runAnomalyDetection(prisma)
    } catch (detErr) {
      console.error('Auto anomaly detection run warning:', detErr)
    }

    const where = {
      ...(status ? { status: status as never } : {}),
      ...(severity ? { severity } : {}),
      isAnomaly: true,
    }
    const [data, total] = await prisma.$transaction([
      prisma.validationResult.findMany({
        where, include: { generationRun: { select: { businessId: true } } },
        orderBy: { createdAt: p.sortDir }, ...paginate(p),
      }),
      prisma.validationResult.count({ where }),
    ])
    res.json(paginatedResponse(data.map(toDto), total, p))
  } catch (e) { next(e) }
})

/** POST /anomalies/detect — manually triggers detector run */
router.post('/detect', async (req, res, next) => {
  try {
    const result = await runAnomalyDetection(prisma)
    res.json({
      message: 'Anomaly detection run complete',
      evaluatedCount: result.evaluatedCount,
      detectedAnomalies: result.anomalies.map(toDto),
    })
  } catch (e) { next(e) }
})

/** POST /anomalies/fixtures/seed — seeds isolated evaluation fixtures */
router.post('/fixtures/seed', async (req, res, next) => {
  try {
    const fixtures = await seedEvaluationFixtures(prisma)
    const result = await runAnomalyDetection(prisma)
    res.status(201).json({
      message: 'Evaluation fixtures seeded and detected successfully',
      fixtures,
      detectedCount: result.anomalies.length,
    })
  } catch (e) { next(e) }
})

const updateSchema = z.object({
  status: z.enum(['Open', 'Investigating', 'Resolved']),
})

/** PATCH /anomalies/:id */
router.patch('/:id', validateBody(updateSchema), async (req, res, next) => {
  try {
    const id = req.params.id as string
    const { status } = req.body as z.infer<typeof updateSchema>
    const anomaly = await prisma.validationResult.findUnique({
      where: { id },
      include: { generationRun: { select: { businessId: true } } },
    })
    if (!anomaly) throw new AppError(404, 'Anomaly not found.', 'NOT_FOUND')
    const updated = await prisma.validationResult.update({
      where: { id },
      data: { status: status as never },
      include: { generationRun: { select: { businessId: true } } },
    })
    await audit(req.user!.id, `Marked anomaly ${status.toLowerCase()}`, 'ValidationResult', anomaly.id,
      { status: anomaly.status }, { status })
    res.json(toDto(updated))
  } catch (e) { next(e) }
})

export default router
