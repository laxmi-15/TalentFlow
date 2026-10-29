export const STAGES = ['Applied', 'Screen', 'Interview', 'Final', 'Offer', 'Hired'] as const
export type Stage = (typeof STAGES)[number]
export type Role = 'Admin' | 'Recruiter' | 'Hiring Manager' | 'Interviewer' | 'Approver'
export const ROLES_LIST: Role[] = ['Admin', 'Recruiter', 'Hiring Manager', 'Interviewer', 'Approver']
export interface User { id: string; name: string; email: string; role: Role; active: boolean }
export interface Settings { orgName: string; timezone: string; requireOfferApproval: boolean }
export interface Requisition { id: string; title: string; department: string; location: string; hiringManager: string; headcount: number; status: 'Draft' | 'Pending approval' | 'Open' | 'Closed' | 'Rejected'; bandMin: number; bandMax: number; createdAt: string }
export interface Candidate { id: string; name: string; email: string; phone?: string | null; role: string; location: string; source: string; experienceYears: number; skills: string[]; createdAt: string; applications?: { id: string; stage: string; requisitionId: string; requisitionTitle: string }[] }
export interface Application {
  id: string
  candidateId: string
  candidateName: string
  requisitionId: string
  requisitionTitle: string
  stage: Stage
  score: number | null
  avgRating?: number | null
  latestRecommendation?: string | null
  scorecardCount?: number
  hasPendingReview?: boolean
  source: string
  updatedAt: string
}
export interface Interview { id: string; applicationId: string; candidateName: string; title: string; start: string; end: string; panel: string[]; status: 'Scheduled' | 'Completed' | 'Cancelled' }
export interface Interviewer { id: string; name: string; team: string; availability: boolean[][] } // [day Mon..Fri][block AM, Midday, PM]
export interface Panel { id: string; name: string; focus: string; members: string[] }
export interface Scorecard { id: string; applicationId: string; candidateName: string; interviewer: string; ratings: Record<string, number>; recommendation: string; notes: string; submittedAt: string }
export interface Offer { id: string; applicationId: string; candidateName: string; role: string; base: number; bonusPct: number; bandMin: number; bandMax: number; status: 'Pending approval' | 'Approved' | 'Rejected' | 'Sent'; createdAt: string }
export interface Approval { id: string; type: 'Requisition' | 'Offer'; subjectId: string; subject: string; requestedBy: string; status: 'Pending' | 'Approved' | 'Rejected'; reason?: string; createdAt: string }
export interface Anomaly { id: string; type: string; severity: 'Low' | 'Medium' | 'High'; status: 'Open' | 'Investigating' | 'Resolved'; subject: string; detail: string; detectedAt: string }
export interface AuditEvent { id: string; actor: string; action: string; entity: string; entityId: string; at: string }
export interface DataCheck { name: string; passed: number; total: number }
export interface DataQualityReport { id: string; generatedAt: string; rows: number; seed: number; checks: DataCheck[] }
export interface Analytics { kpis: { label: string; value: string; delta: string; up: boolean }[]; trend: { week: string; applications: number; hires: number }[]; funnel: { stage: string; count: number }[]; sources: { name: string; value: number }[] }
export const RUBRIC = [
  { key: 'technical', label: 'Technical depth', hint: 'Domain knowledge and quality of solutions' },
  { key: 'problem', label: 'Problem solving', hint: 'Structure, trade-offs and handling ambiguity' },
  { key: 'communication', label: 'Communication', hint: 'Clarity, listening and concision' },
  { key: 'collaboration', label: 'Collaboration', hint: 'Working with others and giving feedback' },
  { key: 'values', label: 'Values alignment', hint: 'Ownership, curiosity and integrity' },
] as const
