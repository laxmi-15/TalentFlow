// Typed service modules. Each call hits the real REST API; only if the API is unreachable (network error)
// or demo mode is forced does it fall back to the isolated in-memory mock store. HTTP errors are never masked.
import { http, ApiError, demoMode, DEMO_FORCED, sleep, setToken, getToken } from './client'
import { db, log, nid, analytics as mockAnalytics, makeReport } from '../mock/store'
import type * as T from './types'

type M = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
const c = <X>(x: X): X => structuredClone(x)
async function call<R>(method: M, path: string, body: unknown, mock: () => R): Promise<R> {
  if (DEMO_FORCED) { demoMode.set(true); await sleep(250); return mock() }
  try {
    const res = await http<R>(method, path, body)
    demoMode.set(false)
    return res
  } catch (e) {
    if (e instanceof ApiError && e.status === 0) { demoMode.set(true); await sleep(250); return mock() }
    throw e
  }
}
const me = () => db.users[0].name

export const auth = {
  login: async (email: string, password = 'TalentFlow2026!') => {
    const res = await http<{ token: string; user: T.User }>('POST', '/auth/login', { email, password })
    setToken(res.token)
    demoMode.set(false)
    return res
  },
  me: async (): Promise<T.User> => {
    if (DEMO_FORCED) {
      demoMode.set(true)
      return c(db.users[0])
    }
    return call<T.User>('GET', '/auth/me', undefined, () => c(db.users[0]))
  },
  signOut: async () => {
    try { await http<void>('POST', '/auth/logout', undefined) } catch {}
    setToken(null)
  },
  users: () => call<T.User[]>('GET', '/users', undefined, () => c(db.users)),
  setRole: (id: string, role: T.Role) => call<T.User>('PATCH', `/users/${id}`, { role: role === 'Hiring Manager' ? 'HiringManager' : role }, () => { const u = db.users.find((x) => x.id === id)!; u.role = role; log(me(), 'Changed role', 'User', id); return c(u) }),
  settings: () => call<T.Settings>('GET', '/settings', undefined, () => c(db.settings)),
  saveSettings: (s: T.Settings) => call<T.Settings>('PUT', '/settings', s, () => { db.settings = c(s); log(me(), 'Updated settings', 'Settings', 'org'); return c(db.settings) }),
}
export const requisitions = {
  list: () => call<T.Requisition[]>('GET', '/requisitions', undefined, () => c(db.requisitions)),
  create: (b: Pick<T.Requisition, 'title' | 'department' | 'location' | 'headcount' | 'bandMin' | 'bandMax'>) => call<T.Requisition>('POST', '/requisitions', b, () => {
    const q: T.Requisition = { ...b, id: nid('REQ'), hiringManager: me(), status: 'Pending approval', createdAt: new Date().toISOString() }
    db.requisitions.unshift(q); db.approvals.unshift({ id: nid('APR'), type: 'Requisition', subjectId: q.id, subject: `${q.id} — ${q.title}`, requestedBy: me(), status: 'Pending', createdAt: q.createdAt }); log(me(), 'Created requisition', 'Requisition', q.id); return c(q)
  }),
}
export const candidates = {
  list: () => call<T.Candidate[]>('GET', '/candidates', undefined, () => c(db.candidates)),
  get: (id: string) => call<T.Candidate>('GET', `/candidates/${id}`, undefined, () => { const x = db.candidates.find((k) => k.id === id); if (!x) throw new ApiError(404, 'That candidate was not found.'); return c(x) }),
  create: (b: {
    name: string
    email: string
    phone?: string | null
    location: string
    experienceYears: number
    skills: string[]
    targetRole?: string | null
    requisitionId?: string | null
    source: string
  }) => call<T.Candidate>('POST', '/candidates', b, () => {
    const id = nid('CAN')
    const item: T.Candidate = {
      id,
      name: b.name,
      email: b.email,
      phone: b.phone ?? null,
      role: b.targetRole || 'General Candidate',
      location: b.location,
      source: b.source,
      experienceYears: b.experienceYears,
      skills: b.skills,
      createdAt: new Date().toISOString(),
    }
    db.candidates.unshift(item)
    log(me(), 'Created candidate', 'Candidate', id)
    return c(item)
  }),
}
export const applications = {
  list: () => call<T.Application[]>('GET', '/applications', undefined, () => c(db.applications)),
  move: (id: string, stage: T.Stage) => call<T.Application>('PATCH', `/applications/${id}`, { stage }, () => { const a = db.applications.find((x) => x.id === id)!; a.stage = stage; a.updatedAt = new Date().toISOString(); log(me(), `Moved to ${stage}`, 'Application', id); return c(a) }),
}
export const interviews = {
  list: () => call<T.Interview[]>('GET', '/interviews', undefined, () => c(db.interviews)),
  schedule: (b: { applicationId: string; start: string; durationMin: number; panelId: string }) => call<T.Interview>('POST', '/interviews', b, () => {
    const a = db.applications.find((x) => x.id === b.applicationId)!, p = db.panels.find((x) => x.id === b.panelId)!
    const s = new Date(b.start).getTime(); const i: T.Interview = { id: nid('INT'), applicationId: a.id, candidateName: a.candidateName, title: p.name, start: new Date(s).toISOString(), end: new Date(s + b.durationMin * 60000).toISOString(), panel: p.members.slice(0, 3), status: 'Scheduled' }
    db.interviews.push(i); log(me(), 'Scheduled interview', 'Interview', i.id); return c(i)
  }),
  cancel: (id: string) => call<T.Interview>('PATCH', `/interviews/${id}`, { status: 'Cancelled' }, () => { const i = db.interviews.find((x) => x.id === id)!; i.status = 'Cancelled'; log(me(), 'Cancelled interview', 'Interview', id); return c(i) }),
  interviewers: () => call<T.Interviewer[]>('GET', '/interviewers', undefined, () => c(db.interviewers)),
  toggleSlot: (id: string, day: number, block: number, free: boolean) => call<T.Interviewer>('PATCH', `/interviewers/${id}/availability`, { day, block, free }, () => { const v = db.interviewers.find((x) => x.id === id)!; v.availability[day][block] = free; return c(v) }),
  panels: () => call<T.Panel[]>('GET', '/panels', undefined, () => c(db.panels)),
  createPanel: (b: { name: string; focus: string; members: string[] }) => call<T.Panel>('POST', '/panels', b, () => { const p = { ...b, id: nid('PNL') }; db.panels.push(p); log(me(), 'Created panel', 'Panel', p.id); return c(p) }),
  removeMember: (id: string, member: string) => call<T.Panel>('DELETE', `/panels/${id}/members/${encodeURIComponent(member)}`, undefined, () => { const p = db.panels.find((x) => x.id === id)!; p.members = p.members.filter((m) => m !== member); return c(p) }),
}
export const scorecards = {
  list: () => call<T.Scorecard[]>('GET', '/scorecards', undefined, () => c(db.scorecards)),
  submit: (b: {
    applicationId: string
    interviewBusinessId?: string
    interviewId?: string
    recommendation: string
    notes?: string
    ratings: Record<string, number>
  }) => call<T.Scorecard>('POST', '/scorecards', b, () => {
    const a = db.applications.find((x) => x.id === b.applicationId)!
    const s: T.Scorecard = {
      id: nid('SC'),
      applicationId: a.id,
      candidateName: a.candidateName,
      interviewer: me(),
      recommendation: b.recommendation,
      notes: b.notes || '',
      ratings: b.ratings,
      submittedAt: new Date().toISOString(),
    }
    db.scorecards.unshift(s)
    log(me(), 'Submitted scorecard', 'Scorecard', s.id)
    return c(s)
  }),
}
export const offers = {
  list: () => call<T.Offer[]>('GET', '/offers', undefined, () => c(db.offers)),
  create: (b: { applicationId: string; base: number; bonusPct: number }) => call<T.Offer>('POST', '/offers', b, () => {
    const a = db.applications.find((x) => x.id === b.applicationId)!, q = db.requisitions.find((x) => x.id === a.requisitionId)!
    const o: T.Offer = { ...b, id: nid('OFR'), candidateName: a.candidateName, role: a.requisitionTitle, bandMin: q.bandMin, bandMax: q.bandMax, status: 'Pending approval', createdAt: new Date().toISOString() }
    db.offers.unshift(o); db.approvals.unshift({ id: nid('APR'), type: 'Offer', subjectId: o.id, subject: `${o.candidateName} — ${o.role}`, requestedBy: me(), status: 'Pending', createdAt: o.createdAt }); log(me(), 'Created offer', 'Offer', o.id); return c(o)
  }),
}
export const approvals = {
  list: () => call<T.Approval[]>('GET', '/approvals', undefined, () => c(db.approvals)),
  decide: (id: string, decision: 'Approved' | 'Rejected', reason: string) => call<T.Approval>('POST', `/approvals/${id}/decision`, { decision, reason }, () => {
    const a = db.approvals.find((x) => x.id === id)!; a.status = decision; a.reason = reason
    const q = db.requisitions.find((x) => x.id === a.subjectId), o = db.offers.find((x) => x.id === a.subjectId)
    if (q) q.status = decision === 'Approved' ? 'Open' : 'Rejected'
    if (o) o.status = decision === 'Approved' ? 'Approved' : 'Rejected'
    log(me(), `${decision} ${a.type.toLowerCase()}`, a.type, a.subjectId); return c(a)
  }),
}
export const analytics = { overview: (days: number) => call<T.Analytics>('GET', `/analytics/overview?days=${days}`, undefined, () => mockAnalytics(days)) }
export const anomalies = {
  list: () => call<T.Anomaly[]>('GET', '/anomalies', undefined, () => c(db.anomalies)),
  update: (id: string, status: T.Anomaly['status']) => call<T.Anomaly>('PATCH', `/anomalies/${id}`, { status }, () => { const a = db.anomalies.find((x) => x.id === id)!; a.status = status; log(me(), `Marked ${status.toLowerCase()}`, 'Anomaly', id); return c(a) }),
}
export const audit = { list: () => call<T.AuditEvent[]>('GET', '/audit-events', undefined, () => c(db.audit)) }
export const dataQuality = {
  reports: () => call<T.DataQualityReport[]>('GET', '/data-quality/reports', undefined, () => c(db.reports)),
  generate: (b: { rows: number; seed: number }) => call<T.DataQualityReport>('POST', '/data-quality/reports', b, () => { const r = makeReport(b.rows, b.seed); db.reports.unshift(r); log(me(), 'Generated synthetic dataset', 'DataQuality', r.id); return c(r) }),
}
