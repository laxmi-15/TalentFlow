// Business ID generation with database-backed sequences
// Format examples: REQ-2026-000001, CAND-000001, INT-2026-000001
import { prisma } from './db'

/**
 * Atomically get the next value for a sequence scope.
 * Uses a database upsert + increment to prevent race conditions.
 */
async function nextSeq(scope: string): Promise<number> {
  const result = await prisma.$queryRaw<[{ next_val: bigint }]>`
    INSERT INTO id_sequences (scope, next_val, updated_at)
    VALUES (${scope}, 2, now())
    ON CONFLICT (scope) DO UPDATE
      SET next_val = id_sequences.next_val + 1,
          updated_at = now()
    RETURNING next_val
  `
  return Number(result[0].next_val)
}

function pad(n: number, digits = 6): string {
  return String(n).padStart(digits, '0')
}

function yearScope(prefix: string): string {
  return `${prefix}-${new Date().getFullYear()}`
}

export const bizId = {
  user: () => nextSeq('USR').then((n) => `USR-${pad(n)}`),
  requisition: () => nextSeq(yearScope('REQ')).then((n) => `REQ-${new Date().getFullYear()}-${pad(n)}`),
  candidate: () => nextSeq('CAND').then((n) => `CAND-${pad(n)}`),
  application: (candBid: string, reqBid: string) => Promise.resolve(`APP-${candBid}-${reqBid}`),
  panel: () => nextSeq('PNL').then((n) => `PNL-${pad(n)}`),
  interview: () => nextSeq(yearScope('INT')).then((n) => `INT-${new Date().getFullYear()}-${pad(n)}`),
  scorecard: (intBid: string, ivrUserId: string) => Promise.resolve(`SCORE-${intBid}-${ivrUserId}`),
  offer: () => nextSeq(yearScope('OFF')).then((n) => `OFF-${new Date().getFullYear()}-${pad(n)}`),
  approval: () => nextSeq('APR').then((n) => `APR-${pad(n)}`),
  audit: () => nextSeq('AUD').then((n) => `AUD-${pad(n)}`),
  generation: () => nextSeq('GEN').then((n) => `GEN-${pad(n)}`),
}
