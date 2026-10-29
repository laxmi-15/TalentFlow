// Integration tests — Health check, Swagger docs, auth, and error handling
import request from 'supertest'
import { describe, it, expect } from 'vitest'
import app from '../index'

describe('GET /api/v1/health', () => {
  it('returns 200 with status field and db connection', async () => {
    const res = await request(app).get('/api/v1/health')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('status', 'ok')
    expect(res.body).toHaveProperty('db', 'connected')
    expect(res.body.timestamp).toBeDefined()
  })
})

describe('Swagger Documentation', () => {
  it('serves OpenAPI 3.0 specification at /api/v1/openapi.json', async () => {
    const res = await request(app).get('/api/v1/openapi.json')
    expect(res.status).toBe(200)
    expect(res.body.openapi).toBe('3.0.3')
    expect(res.body.info.title).toContain('TalentFlow')
    expect(res.body.paths).toHaveProperty('/health')
    expect(res.body.paths).toHaveProperty('/requisitions')
    expect(res.body.paths).toHaveProperty('/candidates')
    expect(res.body.paths).toHaveProperty('/applications')
    expect(res.body.paths).toHaveProperty('/interviews')
    expect(res.body.paths).toHaveProperty('/offers')
    expect(res.body.paths).toHaveProperty('/approvals')
  })

  it('serves Swagger UI at /api/v1/docs/', async () => {
    const res = await request(app).get('/api/v1/docs/')
    expect(res.status).toBe(200)
    expect(res.text).toContain('Swagger UI')
  })
})

describe('Authentication', () => {
  it('rejects missing token with 401', async () => {
    const res = await request(app).get('/api/v1/requisitions')
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('UNAUTHENTICATED')
  })

  it('rejects invalid token with 401', async () => {
    const res = await request(app)
      .get('/api/v1/requisitions')
      .set('Authorization', 'Bearer bad-token')
    expect(res.status).toBe(401)
  })

  it('POST /auth/login rejects wrong credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'notexist@example.test', password: 'wrong' })
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('INVALID_CREDENTIALS')
  })

  it('POST /auth/login with valid credentials returns token and user profile', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'meera@example.test', password: 'TalentFlow2026!' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
    expect(res.body.user).toHaveProperty('role', 'Admin')
    expect(res.body.user).toHaveProperty('email', 'meera@example.test')
  })
})

describe('Shared Error Handling', () => {
  it('returns structured 404 for unknown route', async () => {
    const res = await request(app).get('/api/v1/nonexistent')
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('NOT_FOUND')
    expect(res.body.message).toBe('Route not found.')
  })

  it('returns structured 400 with details for validation error', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({})
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
    expect(res.body.message).toBe('Validation failed.')
    expect(res.body.details).toHaveProperty('email')
    expect(res.body.details).toHaveProperty('password')
  })
})
