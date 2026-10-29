// DEMO DATA ONLY. Entirely synthetic; mutations live in browser memory and are never sent to a server.
import type * as T from '../api/types'
import { STAGES } from '../api/types'

function rng(s: number) { return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const r = rng(7)
const pick = <X>(a: X[]): X => a[Math.floor(r() * a.length)]
const int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1))
const DAY = 86400000
const now = Date.now()
const iso = (ms: number) => new Date(ms).toISOString()
const F = ['Ava', 'Noah', 'Mira', 'Leo', 'Zara', 'Omar', 'Ines', 'Kai', 'Tara', 'Iris', 'Ravi', 'Elan', 'Nia', 'Theo', 'Sana', 'Milo']
const L = ['Hartwell', 'Okafor', 'Lindqvist', 'Moreau', 'Varga', 'Castellan', 'Ibarra', 'Novak', 'Sato', 'Brennan', 'Kovacs', 'Adeyemi', 'Rosen', 'Vidal', 'Marlow', 'Quill']
const ROLES: [string, string, number, number][] = [['Senior Backend Engineer', 'Engineering', 130, 175], ['Product Designer', 'Design', 95, 135], ['Data Analyst', 'Analytics', 80, 115], ['Account Executive', 'Sales', 90, 140], ['People Partner', 'People', 85, 120], ['Security Engineer', 'Engineering', 140, 190]]
const SOURCES = ['Referral', 'Careers site', 'Agency', 'Job board', 'Campus']
const SKILLS = ['TypeScript', 'Python', 'SQL', 'Figma', 'Negotiation', 'Kubernetes', 'Research', 'Excel', 'Leadership', 'Security']
const NAMES = ['Priya Raman', 'Daniel Osei', 'Hannah Weiss', 'Marco Bellini', 'Yuki Tanaka', 'Selin Aydin', 'Grace Mbeki', 'Tomas Reyes']
const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))

export const db = {
  requisitions: [] as T.Requisition[], candidates: [] as T.Candidate[], applications: [] as T.Application[], interviews: [] as T.Interview[],
  interviewers: [] as T.Interviewer[], panels: [] as T.Panel[], scorecards: [] as T.Scorecard[], offers: [] as T.Offer[], approvals: [] as T.Approval[],
  anomalies: [] as T.Anomaly[], audit: [] as T.AuditEvent[], reports: [] as T.DataQualityReport[], users: [] as T.User[],
  settings: { orgName: 'Northwind Talent Co. (demo)', timezone: 'Asia/Kolkata', requireOfferApproval: true } as T.Settings,
}
let seq = 100
export const nid = (p: string) => `${p}-${++seq}`
export function log(actor: string, action: string, entity: string, entityId: string) { db.audit.unshift({ id: nid('AUD'), actor, action, entity, entityId, at: iso(Date.now()) }) }

const RS: T.Requisition['status'][] = ['Open', 'Open', 'Pending approval', 'Open', 'Draft', 'Pending approval', 'Open', 'Closed', 'Open']
RS.forEach((status, i) => { const [title, department, lo, hi] = ROLES[i % 6]; db.requisitions.push({ id: `REQ-${1040 + i}`, title, department, location: pick(['Remote', 'Pune', 'Berlin', 'Austin']), hiringManager: pick(NAMES), headcount: int(1, 3), status, bandMin: lo * 1000, bandMax: hi * 1000, createdAt: iso(now - int(5, 80) * DAY) }) })
const open = db.requisitions.filter((x) => x.status === 'Open')
const WEIGHTS: T.Stage[] = ['Applied', 'Applied', 'Applied', 'Screen', 'Screen', 'Interview', 'Interview', 'Final', 'Offer', 'Hired']
for (let i = 0; i < 48; i++) {
  const f = pick(F), l = pick(L), req = pick(open)
  const c: T.Candidate = { id: `CAN-${2000 + i}`, name: `${f} ${l}`, email: `${f}.${l}${i}@example.test`.toLowerCase(), role: req.title, location: pick(['Remote', 'Pune', 'Berlin', 'Austin', 'Lisbon']), source: pick(SOURCES), experienceYears: int(1, 14), skills: [pick(SKILLS), pick(SKILLS), pick(SKILLS)].filter((v, k, a) => a.indexOf(v) === k), createdAt: iso(now - int(2, 60) * DAY) }
  db.candidates.push(c)
  db.applications.push({ id: `APP-${3000 + i}`, candidateId: c.id, candidateName: c.name, requisitionId: req.id, requisitionTitle: req.title, stage: pick(WEIGHTS), score: int(52, 96), source: c.source, updatedAt: iso(now - int(0, 20) * DAY) })
}
const mid = db.applications.filter((a) => a.stage === 'Interview' || a.stage === 'Final').slice(0, 12)
mid.forEach((a, i) => { const s = monday.getTime() + ((i % 5) + (i >= 8 ? 7 : 0)) * DAY + (9 + ((i * 2) % 7)) * 3600000; db.interviews.push({ id: `INT-${4000 + i}`, applicationId: a.id, candidateName: a.candidateName, title: i % 2 ? 'Technical deep dive' : 'Panel interview', start: iso(s), end: iso(s + 3600000), panel: [pick(NAMES), pick(NAMES)].filter((v, k, x) => x.indexOf(v) === k), status: s < now ? 'Completed' : 'Scheduled' }) })
NAMES.forEach((n, i) => db.interviewers.push({ id: `IVR-${i + 1}`, name: n, team: ROLES[i % 6][1], availability: Array.from({ length: 5 }, () => [r() > 0.35, r() > 0.35, r() > 0.45]) }))
db.panels.push({ id: 'PNL-1', name: 'Backend engineering loop', focus: 'System design, code quality', members: NAMES.slice(0, 3) }, { id: 'PNL-2', name: 'Design critique panel', focus: 'Portfolio review, craft', members: NAMES.slice(3, 5) }, { id: 'PNL-3', name: 'Commercial panel', focus: 'Pipeline, negotiation', members: NAMES.slice(5, 8) })
db.interviews.filter((i) => i.status === 'Completed').slice(0, 5).forEach((i, k) => db.scorecards.push({ id: `SC-${k + 1}`, applicationId: i.applicationId, candidateName: i.candidateName, interviewer: i.panel[0], ratings: { technical: int(2, 4), problem: int(2, 4), communication: int(2, 4), collaboration: int(2, 4), values: int(2, 4) }, recommendation: pick(['Yes', 'Strong yes', 'No']), notes: 'Structured, clear reasoning; probe scalability further in the next round.', submittedAt: i.end }))
db.applications.filter((a) => a.stage === 'Offer' || a.stage === 'Hired').slice(0, 8).forEach((a, i) => {
  const q = db.requisitions.find((x) => x.id === a.requisitionId)!
  const st: T.Offer['status'][] = ['Pending approval', 'Approved', 'Sent', 'Pending approval']
  const o: T.Offer = { id: `OFR-${5000 + i}`, applicationId: a.id, candidateName: a.candidateName, role: a.requisitionTitle, base: Math.round((q.bandMin + r() * (q.bandMax - q.bandMin) * 1.12) / 500) * 500, bonusPct: int(5, 15), bandMin: q.bandMin, bandMax: q.bandMax, status: st[i % 4], createdAt: iso(now - int(1, 14) * DAY) }
  db.offers.push(o)
  if (o.status === 'Pending approval') db.approvals.push({ id: nid('APR'), type: 'Offer', subjectId: o.id, subject: `${o.candidateName} — ${o.role}`, requestedBy: pick(NAMES), status: 'Pending', createdAt: o.createdAt })
})
db.requisitions.filter((x) => x.status === 'Pending approval').forEach((q) => db.approvals.push({ id: nid('APR'), type: 'Requisition', subjectId: q.id, subject: `${q.id} — ${q.title}`, requestedBy: q.hiringManager, status: 'Pending', createdAt: q.createdAt }))
db.offers.filter((o) => o.base > o.bandMax).forEach((o) => db.anomalies.push({ id: nid('ANM'), type: 'Offer outside band', severity: 'High', status: 'Open', subject: o.id, detail: `${o.candidateName}: base exceeds band maximum by ${(o.base - o.bandMax).toLocaleString()}.`, detectedAt: o.createdAt }))
const AT: [string, T.Anomaly['severity']][] = [['Duplicate candidate', 'Medium'], ['Stage skipped', 'Medium'], ['Stale application', 'Low'], ['Scorecard overdue', 'Medium'], ['Interviewer overbooked', 'Low']]
for (let i = 0; i < 9; i++) { const [type, severity] = AT[i % 5], a = db.applications[i * 4]; db.anomalies.push({ id: nid('ANM'), type, severity, status: i % 4 === 0 ? 'Investigating' : i % 7 === 6 ? 'Resolved' : 'Open', subject: a.id, detail: `${type} flagged for ${a.candidateName} (${a.requisitionId}).`, detectedAt: iso(now - int(0, 25) * DAY) }) }
;['Moved stage', 'Viewed candidate', 'Approved requisition', 'Submitted scorecard', 'Edited rubric', 'Exported report'].forEach((act, i) => { for (let k = 0; k < 7; k++) db.audit.push({ id: `AUD-${i}${k}`, actor: pick(NAMES), action: act, entity: pick(['Application', 'Candidate', 'Requisition', 'Scorecard']), entityId: pick(db.applications).id, at: iso(now - int(0, 30) * DAY - int(0, 80000000)) }) })
db.audit.sort((a, b) => b.at.localeCompare(a.at))
export function makeReport(rows: number, seed: number): T.DataQualityReport {
  const q = rng(seed)
  const chk = (name: string, miss: number): T.DataCheck => ({ name, total: rows, passed: Math.round(rows * (1 - q() * miss)) })
  return { id: nid('DQ'), generatedAt: iso(Date.now()), rows, seed, checks: [chk('Unique candidate identifiers', 0.002), chk('Valid synthetic email domain (example.test)', 0.001), chk('Salary within requisition band', 0.04), chk('Stage transitions in order', 0.02), chk('Interview times inside working hours', 0.03), chk('No real-person identifiers detected', 0.0005)] }
}
db.reports.push(makeReport(5000, 11))
;[['Meera Joshi', 'Admin'], ['Chris Alder', 'Recruiter'], ['Dana Whitfield', 'Hiring Manager'], ['Samir Qureshi', 'Interviewer'], ['Lena Fischer', 'Approver'], ['Paulo Mendes', 'Recruiter']].forEach(([name, role], i) => db.users.push({ id: `USR-${i + 1}`, name, email: `${name.split(' ')[0].toLowerCase()}@example.test`, role: role as T.Role, active: i !== 5 }))
export function analytics(days: number): T.Analytics {
  const q = rng(days), weeks = Math.max(4, Math.round(days / 7))
  const cnt = (s: T.Stage) => db.applications.filter((a) => STAGES.indexOf(a.stage) >= STAGES.indexOf(s)).length
  const srcs = SOURCES.map((name) => ({ name, value: db.applications.filter((a) => a.source === name).length }))
  return {
    kpis: [{ label: 'Open requisitions', value: String(db.requisitions.filter((x) => x.status === 'Open').length), delta: '+2 this month', up: true }, { label: 'Active candidates', value: String(db.applications.filter((a) => a.stage !== 'Hired').length), delta: '+8%', up: true }, { label: 'Pending approvals', value: String(db.approvals.filter((a) => a.status === 'Pending').length), delta: 'Needs review', up: false }, { label: 'Median days to offer', value: String(Math.round(24 + q() * 6)), delta: '-3 days', up: true }],
    trend: Array.from({ length: weeks }, (_, i) => ({ week: `W${i + 1}`, applications: Math.round(30 + q() * 40), hires: Math.round(2 + q() * 6) })),
    funnel: STAGES.map((s) => ({ stage: s, count: cnt(s) })), sources: srcs,
  }
}
