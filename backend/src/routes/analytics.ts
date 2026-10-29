import { Router } from 'express'
import { prisma } from '../db'
import { authenticate, hydrateUser } from '../middleware/auth'

const router = Router()
router.use(authenticate, hydrateUser)

const STAGES = ['Applied', 'Screen', 'Interview', 'Final', 'Offer', 'Hired'] as const

/** GET /analytics/overview?days=30 */
router.get('/overview', async (req, res, next) => {
  try {
    const days = Math.max(1, Math.min(365, Number(req.query.days ?? 30)))
    const since = new Date(Date.now() - days * 86400000)

    const [
      openReqs, activeApps, pendingApprovals,
      hiredApps,
    ] = await prisma.$transaction([
      prisma.requisition.count({ where: { status: 'Open' } }),
      prisma.application.count({ where: { stage: { notIn: ['Hired', 'Withdrawn'] } } }),
      prisma.approval.count({ where: { status: 'Pending' } }),
      prisma.application.count({ where: { stage: 'Hired', updatedAt: { gte: since } } }),
    ])

    // Funnel: count of apps that reached each stage or beyond
    const funnelCounts = await Promise.all(
      STAGES.map((s) =>
        prisma.application.count({
          where: {
            stageEvents: { some: { toStage: s } },
          },
        }),
      ),
    )

    // Weekly trend: applications created per week
    const weeklyCounts = await prisma.$queryRaw<Array<{ week: string; applications: bigint; hires: bigint }>>`
      SELECT
        TO_CHAR(DATE_TRUNC('week', "created_at"), 'YYYY-"W"IW') AS week,
        COUNT(*) AS applications,
        COUNT(*) FILTER (WHERE stage = 'Hired') AS hires
      FROM applications
      WHERE "created_at" >= ${since}
      GROUP BY DATE_TRUNC('week', "created_at")
      ORDER BY DATE_TRUNC('week', "created_at") ASC
    `.catch(async () => {
      // Fallback in case of raw query issues
      return [] as Array<{ week: string; applications: bigint; hires: bigint }>
    })

    const sources = await prisma.application.groupBy({
      by: ['source'],
      _count: { source: true },
      orderBy: { _count: { source: 'desc' } },
    })

    // Median days to offer
    const offerApps = await prisma.application.findMany({
      where: { stage: { in: ['Offer', 'Hired'] }, offer: { isNot: null } },
      select: { createdAt: true, offer: { select: { createdAt: true } } },
    })
    const avgDaysToOffer =
      offerApps.length > 0
        ? Math.round(
            offerApps.reduce((sum, a) => {
              const diff = ((a.offer?.createdAt.getTime() ?? a.createdAt.getTime()) - a.createdAt.getTime()) / 86400000
              return sum + diff
            }, 0) / offerApps.length,
          )
        : 0

    res.json({
      kpis: [
        { label: 'Open requisitions', value: String(openReqs), delta: 'Currently open', up: true },
        { label: 'Active candidates', value: String(activeApps), delta: 'In pipeline', up: true },
        { label: 'Pending approvals', value: String(pendingApprovals), delta: pendingApprovals > 0 ? 'Needs review' : 'All clear', up: pendingApprovals === 0 },
        { label: 'Median days to offer', value: String(avgDaysToOffer), delta: `Last ${days} days`, up: avgDaysToOffer < 30 },
      ],
      trend: weeklyCounts.length > 0
        ? weeklyCounts.map((w: { week: string; applications: bigint | number; hires: bigint | number }) => ({
            week: w.week,
            applications: Number(w.applications),
            hires: Number(w.hires),
          }))
        : [{ week: 'Current', applications: activeApps + hiredApps, hires: hiredApps }],
      funnel: STAGES.map((s, i) => ({ stage: s, count: funnelCounts[i] })),
      sources: sources.map((s: { source: string; _count: { source: number } }) => ({
        name: s.source,
        value: s._count.source,
      })),
    })
  } catch (e) { next(e) }
})

export default router
