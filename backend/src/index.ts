// TalentFlow API — Express entry point
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import swaggerUi from 'swagger-ui-express'

import { env } from './config'
import { errorHandler } from './middleware/errorHandler'
import { swaggerDoc } from './swagger'

// Routes
import healthRouter from './routes/health'
import authRouter from './routes/auth'
import usersRouter from './routes/users'
import requisitionsRouter from './routes/requisitions'
import candidatesRouter from './routes/candidates'
import applicationsRouter from './routes/applications'
import panelsRouter from './routes/panels'
import interviewsRouter from './routes/interviews'
import scorecardsRouter from './routes/scorecards'
import offersRouter from './routes/offers'
import approvalsRouter from './routes/approvals'
import analyticsRouter from './routes/analytics'
import anomaliesRouter from './routes/anomalies'
import auditEventsRouter from './routes/auditEvents'
import dataQualityRouter from './routes/dataQuality'

const app = express()

// ─── Security & Middleware ────────────────────────────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false }))
app.use(cors({
  origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
}))
app.use(compression())
app.use(express.json({ limit: '1mb' }))
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// Auth rate limiting
app.use('/api/v1/auth', rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: 20,
  message: { message: 'Too many requests, please try again later.', code: 'RATE_LIMITED' },
}))
// General rate limiting
app.use('/api/v1', rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  message: { message: 'Too many requests, please try again later.', code: 'RATE_LIMITED' },
}))

// ─── OpenAPI / Swagger ────────────────────────────────────────────────────────
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc))
app.get('/api/v1/openapi.json', (_req, res) => res.json(swaggerDoc))

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/v1/health', healthRouter)
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/users', usersRouter)
app.use('/api/v1/settings', usersRouter)  // settings sub-routes live in usersRouter
app.use('/api/v1/requisitions', requisitionsRouter)
app.use('/api/v1/candidates', candidatesRouter)
app.use('/api/v1/applications', applicationsRouter)
// Panels and interviewers share a router (panels.ts)
app.use('/api/v1', panelsRouter)
app.use('/api/v1/interviews', interviewsRouter)
app.use('/api/v1/scorecards', scorecardsRouter)
app.use('/api/v1/offers', offersRouter)
app.use('/api/v1/approvals', approvalsRouter)
app.use('/api/v1/analytics', analyticsRouter)
app.use('/api/v1/anomalies', anomaliesRouter)
app.use('/api/v1/audit-events', auditEventsRouter)
app.use('/api/v1/data-quality', dataQualityRouter)

// 404 for unknown routes
app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found.', code: 'NOT_FOUND' })
})

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler)

// ─── Start Server ────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.listen(env.PORT, () => {
    console.log(`\n🚀 TalentFlow API running at http://localhost:${env.PORT}`)
    console.log(`📖 Swagger UI: http://localhost:${env.PORT}/api/v1/docs`)
    console.log(`🌍 Environment: ${env.NODE_ENV}\n`)
  })
}

export default app
