// Environment configuration with validation
import { existsSync } from 'fs'
import { resolve } from 'path'
import { z } from 'zod'

// Attempt to load .env file if process.loadEnvFile is available
for (const p of [
  resolve(__dirname, '../.env'),
  resolve(__dirname, '../../.env'),
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'backend/.env'),
]) {
  if (existsSync(p)) {
    try {
      if (typeof process.loadEnvFile === 'function') {
        process.loadEnvFile(p)
      }
    } catch {
      // ignore if already loaded
    }
    break
  }
}

export const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL URL'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().default(200),
})

export type EnvConfig = z.infer<typeof envSchema>

export function validateEnv(customEnv = process.env): EnvConfig {
  const result = envSchema.safeParse(customEnv)
  if (!result.success) {
    console.error('❌ Invalid environment variables:')
    for (const [key, issues] of Object.entries(result.error.flatten().fieldErrors)) {
      console.error(`  ${key}: ${issues?.join(', ')}`)
    }
    if (customEnv.NODE_ENV !== 'test') {
      process.exit(1)
    }
    throw new Error('Invalid environment configuration')
  }
  return result.data
}

export const env = validateEnv()
