// Global error handler
import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { env } from '../config'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string = 'APP_ERROR',
    public details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      message: 'Validation failed.',
      code: 'VALIDATION_ERROR',
      details: err.flatten().fieldErrors,
    })
    return
  }

  // Application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      message: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    })
    return
  }

  // Prisma unique constraint violations
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        message: 'A record with this value already exists.',
        code: 'CONFLICT',
        details: err.meta,
      })
      return
    }
    if (err.code === 'P2025') {
      res.status(404).json({ message: 'Record not found.', code: 'NOT_FOUND' })
      return
    }
  }

  // Unknown errors
  console.error('Unhandled error:', err)
  res.status(500).json({
    message: 'An unexpected error occurred.',
    code: 'INTERNAL_ERROR',
    ...(env.NODE_ENV !== 'production' && err instanceof Error ? { stack: err.stack } : {}),
  })
}
