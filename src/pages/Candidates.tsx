import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus } from 'lucide-react'
import { applications, auth, candidates, requisitions, scorecards } from '../api/services'
import { STAGES, type Stage } from '../api/types'
import {
  Async,
  Badge,
  Button,
  Card,
  DataTable,
  Dialog,
  Field,
  PageHeader,
  Select,
  Tabs,
  inputCls,
  statusTone,
  toast,
} from '../components/ui'
import { fmtDate } from '../lib/csv'
import { saved } from '../lib/notify'

const candidateSchema = z.object({
  name: z.string().trim().min(2, 'Enter full name (2+ characters).').max(200),
  email: z.string().trim().email('Enter a valid email address.').max(300),
  phone: z.string().trim().max(30, 'Phone cannot exceed 30 characters.').optional().or(z.literal('')),
  location: z.string().trim().min(1, 'Enter location (e.g. Pune, Remote).').max(100),
  experienceYears: z
    .number()
    .int('Experience must be an integer.')
    .min(0, 'Experience cannot be negative.')
    .max(50, 'Max 50 years.'),
  skills: z.string().trim().min(1, 'Enter at least one skill.'),
  targetRole: z.string().min(1, 'Choose a target role.'),
  source: z.string().min(1, 'Choose a candidate source.'),
})

type CandidateFormValues = z.infer<typeof candidateSchema>

const SOURCES = ['Referral', 'Careers Site', 'Agency', 'JobBoard', 'Campus']

export function Candidates() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [src, setSrc] = useState('')
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const me = useQuery({ queryKey: ['me'], queryFn: auth.me })
  const q = useQuery({ queryKey: ['candidates'], queryFn: candidates.list })
  const reqsQuery = useQuery({ queryKey: ['requisitions'], queryFn: requisitions.list })

  const canAdd = !me.data || me.data.role === 'Admin' || me.data.role === 'Recruiter'

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CandidateFormValues>({
    resolver: zodResolver(candidateSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      location: '',
      experienceYears: 3,
      skills: '',
      targetRole: '',
      source: 'Referral',
    },
  })

  const m = useMutation({
    mutationFn: candidates.create,
    onSuccess: (newCand) => {
      qc.invalidateQueries({ queryKey: ['candidates'] })
      qc.invalidateQueries({ queryKey: ['applications'] })
      saved(`Candidate ${newCand.name} added successfully`)
      setOpen(false)
      reset()
      setServerError(null)
    },
    onError: (err: any) => {
      const msg = err?.message || 'Failed to create candidate.'
      setServerError(msg)
      toast(msg, 'error')
    },
  })

  const onSubmit = (v: CandidateFormValues) => {
    setServerError(null)
    const matchingReq = reqsQuery.data?.find((r) => r.title === v.targetRole)
    const skillsArray = v.skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    m.mutate({
      name: v.name,
      email: v.email,
      phone: v.phone || undefined,
      location: v.location,
      experienceYears: v.experienceYears,
      skills: skillsArray,
      targetRole: v.targetRole,
      requisitionId: matchingReq?.id,
      source: v.source,
    })
  }

  return (
    <>
      <PageHeader
        title="Candidates"
        desc="Everyone in your talent pool. Select a row for the full profile."
        actions={
          canAdd ? (
            <Button
              variant="primary"
              onClick={() => {
                setServerError(null)
                setOpen(true)
              }}
            >
              <Plus size={16} />
              Add candidate
            </Button>
          ) : undefined
        }
      />

      <Async q={q}>
        {(rows) => (
          <DataTable
            csvName="candidates"
            onRow={(r) => nav(`/candidates/${r.id}`)}
            rows={rows.filter((r) => !src || r.source === src)}
            toolbar={
              <Select
                label="Source"
                value={src}
                onChange={setSrc}
                options={[...new Set(rows.map((r) => r.source))]}
              />
            }
            cols={[
              {
                key: 'name',
                header: 'Name',
                sort: (a, b) => a.name.localeCompare(b.name),
                render: (r) => (
                  <Link
                    className="font-medium text-accent"
                    to={`/candidates/${r.id}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {r.name}
                  </Link>
                ),
              },
              { key: 'role', header: 'Target role' },
              { key: 'location', header: 'Location' },
              { key: 'source', header: 'Source' },
              {
                key: 'experienceYears',
                header: 'Years',
                sort: (a, b) => a.experienceYears - b.experienceYears,
              },
              {
                key: 'skills',
                header: 'Skills',
                render: (r) => (
                  <div className="flex flex-wrap gap-1">
                    {r.skills.map((s) => (
                      <Badge key={s}>{s}</Badge>
                    ))}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Async>

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false)
          setServerError(null)
        }}
        title="Add candidate"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {serverError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Full name" error={errors.name?.message}>
                <input className={inputCls} placeholder="e.g. Jane Doe" {...register('name')} />
              </Field>
            </div>

            <Field label="Email address" error={errors.email?.message}>
              <input
                type="email"
                className={inputCls}
                placeholder="e.g. jane.doe@example.test"
                {...register('email')}
              />
            </Field>

            <Field label="Phone (optional)" error={errors.phone?.message}>
              <input
                type="tel"
                className={inputCls}
                placeholder="e.g. +1 555-0199"
                {...register('phone')}
              />
            </Field>

            <Field label="Location" error={errors.location?.message}>
              <input
                className={inputCls}
                placeholder="e.g. Pune, India or Remote"
                {...register('location')}
              />
            </Field>

            <Field label="Years of experience" error={errors.experienceYears?.message}>
              <input
                type="number"
                min={0}
                max={50}
                className={inputCls}
                placeholder="e.g. 5"
                {...register('experienceYears', { valueAsNumber: true })}
              />
            </Field>

            <Field label="Target role" error={errors.targetRole?.message}>
              <select className={inputCls} defaultValue="" {...register('targetRole')}>
                <option value="" disabled>
                  Choose target role...
                </option>
                {(reqsQuery.data ?? []).map((r) => (
                  <option key={r.id} value={r.title}>
                    {r.title} ({r.id})
                  </option>
                ))}
                <option value="General Candidate">General Candidate (Talent Pool)</option>
              </select>
            </Field>

            <Field label="Source" error={errors.source?.message}>
              <select className={inputCls} defaultValue="Referral" {...register('source')}>
                <option value="" disabled>
                  Choose source...
                </option>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>

            <div className="sm:col-span-2">
              <Field label="Skills (comma-separated)" error={errors.skills?.message}>
                <input
                  className={inputCls}
                  placeholder="e.g. React, TypeScript, Python, SQL"
                  {...register('skills')}
                />
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button
              type="button"
              onClick={() => {
                setOpen(false)
                setServerError(null)
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={m.isPending}>
              {m.isPending ? 'Adding candidate...' : 'Add candidate'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}

export function CandidateDetail() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const [tab, setTab] = useState('profile')
  const c = useQuery({ queryKey: ['candidate', id], queryFn: () => candidates.get(id) })
  const apps = useQuery({ queryKey: ['applications'], queryFn: applications.list })
  const sc = useQuery({ queryKey: ['scorecards'], queryFn: scorecards.list })

  const moveStage = useMutation({
    mutationFn: (v: { id: string; stage: Stage }) => applications.move(v.id, v.stage),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ['applications'] })
      qc.invalidateQueries({ queryKey: ['candidate', id] })
      qc.invalidateQueries({ queryKey: ['candidates'] })
      saved(`${a.candidateName} moved to ${a.stage}`)
    },
    onError: (err: any) => toast(err?.message || 'Failed to update application stage.', 'error'),
  })

  return (
    <Async q={c}>
      {(x) => (
        <>
          <PageHeader
            title={x.name}
            desc={`${x.role} · ${x.location} · ${x.email}${x.phone ? ` · ${x.phone}` : ''}`}
          />
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'profile', label: 'Profile' },
              { id: 'apps', label: 'Applications' },
              { id: 'sc', label: 'Scorecards' },
            ]}
          />
          {tab === 'profile' && (
            <Card>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted">Target role</dt>
                  <dd>{x.role}</dd>
                </div>
                <div>
                  <dt className="text-muted">Source</dt>
                  <dd>{x.source}</dd>
                </div>
                <div>
                  <dt className="text-muted">Experience</dt>
                  <dd>{x.experienceYears} years</dd>
                </div>
                {x.phone && (
                  <div>
                    <dt className="text-muted">Phone</dt>
                    <dd>{x.phone}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted">Added</dt>
                  <dd>{fmtDate(x.createdAt)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted">Skills</dt>
                  <dd className="mt-1 flex flex-wrap gap-1">
                    {x.skills.map((s) => (
                      <Badge key={s} tone="indigo">
                        {s}
                      </Badge>
                    ))}
                  </dd>
                </div>
              </dl>
            </Card>
          )}
          {tab === 'apps' && (
            <Async q={apps}>
              {(a) => (
                <DataTable
                  csvName="candidate-applications"
                  rows={a.filter((k) => k.candidateId === id)}
                  cols={[
                    { key: 'requisitionTitle', header: 'Requisition' },
                    {
                      key: 'stage',
                      header: 'Stage',
                      render: (r) => (
                        <select
                          aria-label={`Stage for ${r.candidateName}`}
                          value={r.stage}
                          disabled={moveStage.isPending}
                          onChange={(e) => moveStage.mutate({ id: r.id, stage: e.target.value as Stage })}
                          className={inputCls + ' w-auto py-1 px-2 text-xs'}
                        >
                          {STAGES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      ),
                    },
                    { key: 'score', header: 'Match score', render: (r) => r.score ?? '—' },
                    {
                      key: 'updatedAt',
                      header: 'Updated',
                      render: (r) => fmtDate(r.updatedAt),
                    },
                  ]}
                  empty="No applications for this candidate"
                />
              )}
            </Async>
          )}
          {tab === 'sc' && (
            <Async q={sc}>
              {(s) => (
                <DataTable
                  csvName="candidate-scorecards"
                  rows={s.filter((k) => k.candidateName === x.name)}
                  cols={[
                    { key: 'interviewer', header: 'Interviewer' },
                    {
                      key: 'recommendation',
                      header: 'Recommendation',
                      render: (r) => (
                        <Badge
                          tone={statusTone(
                            /No/.test(r.recommendation) ? 'Reject' : 'Approved',
                          )}
                        >
                          {r.recommendation}
                        </Badge>
                      ),
                    },
                    { key: 'notes', header: 'Notes' },
                    {
                      key: 'submittedAt',
                      header: 'Submitted',
                      render: (r) => fmtDate(r.submittedAt),
                    },
                  ]}
                  empty="No scorecards submitted yet"
                />
              )}
            </Async>
          )}
        </>
      )}
    </Async>
  )
}
export default Candidates
