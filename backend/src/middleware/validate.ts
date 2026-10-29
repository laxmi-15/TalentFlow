// Zod request validation middleware
import type { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) { next(result.error); return }
    req.body = result.data
    next()
  }
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query)
    if (!result.success) { next(result.error); return }
    ;(req as Request & { validatedQuery: unknown }).validatedQuery = result.data
    next()
  }
}
