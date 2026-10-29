// Test environment setup
// Uses a real test database — set TEST_DATABASE_URL in your env
import { existsSync } from 'fs'
import { resolve } from 'path'
import { afterAll } from 'vitest'

for (const p of [
  resolve(__dirname, '../../.env'),
  resolve(__dirname, '../../../.env'),
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'backend/.env'),
]) {
  if (existsSync(p)) {
    try {
      if (typeof process.loadEnvFile === 'function') {
        process.loadEnvFile(p)
      }
    } catch {}
    break
  }
}

// Override DATABASE_URL if TEST_DATABASE_URL is set
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
}

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-key-at-least-32-characters-long'
process.env.JWT_EXPIRES_IN = '1h'
process.env.PORT = '8081'
process.env.CORS_ORIGIN = 'http://localhost:5173'

import { prisma } from '../db'

afterAll(async () => {
  await prisma.$disconnect()
})
