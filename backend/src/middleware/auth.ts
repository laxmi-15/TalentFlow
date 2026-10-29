// JWT authentication + RBAC middleware
import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config'
import { prisma } from '../db'

export interface AuthPayload {
  sub: string  // user UUID
  role: string
  iat: number
  exp: number
}

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; businessId: string; role: string; name: string }
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authentication required.', code: 'UNAUTHENTICATED' })
    return
  }
  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload
    // Attach user info to request (fetched lazily from DB when needed, or from token)
    req.user = { id: payload.sub, businessId: '', role: payload.role, name: '' }
    next()
  } catch {
    res.status(401).json({ message: 'Your session has expired. Sign in again.', code: 'TOKEN_EXPIRED' })
  }
}

/**
 * Hydrate req.user with full DB record. Use in routes that need name/businessId.
 */
export async function hydrateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) { next(); return }
  try {
    const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, businessId: true, role: true, name: true } })
    if (!u) { res.status(401).json({ message: 'User not found.', code: 'USER_NOT_FOUND' }); return }
    req.user = { id: u.id, businessId: u.businessId, role: u.role, name: u.name }
    next()
  } catch (e) { next(e) }
}

export function requireRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: 'You do not have permission to do this.', code: 'FORBIDDEN' })
      return
    }
    next()
  }
}

export function signToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any })
}
