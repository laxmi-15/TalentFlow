// Audit event service — append-only, called from every mutation
import { prisma } from '../db'
import { bizId } from '../bizId'

export async function audit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  beforeState?: unknown,
  afterState?: unknown,
): Promise<void> {
  const businessId = await bizId.audit()
  await prisma.auditEvent.create({
    data: {
      businessId,
      actorId,
      action,
      entityType,
      entityId,
      beforeState: beforeState ? (beforeState as object) : undefined,
      afterState: afterState ? (afterState as object) : undefined,
    },
  })
}
