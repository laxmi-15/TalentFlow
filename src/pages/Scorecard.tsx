import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { applications, auth, interviews, scorecards } from '../api/services'
import { RUBRIC } from '../api/types'
import { Async, Badge, Button, Card, DataTable, Field, PageHeader, inputCls, statusTone, toast } from '../components/ui'
import { fmtDate } from '../lib/csv'
import { saved } from '../lib/notify'

const rate = z.string().min(1, 'Select a rating.')
const schema = z.object({
  applicationId: z.string().min(1, 'Choose the candidate you interviewed.'),
  technical: rate,
  problem: rate,
  communication: rate,
  collaboration: rate,
  values: rate,
  recommendation: z.enum(['Strong yes', 'Yes', 'No', 'Strong no'], { message: 'Choose a recommendation.' }),
  notes: z.string().min(10, 'Add at least 10 characters of evidence.'),
})
type F = z.infer<typeof schema>
const LEVELS = ['1 · Weak', '2 · Mixed', '3 · Solid', '4 · Excellent']

export default function Scorecard() {
  const qc = useQueryClient()
  const me = useQuery({ queryKey: ['me'], queryFn: auth.me })
  const iq = useQuery({ queryKey: ['interviews'], queryFn: interviews.list })
  const aq = useQuery({ queryKey: ['applications'], queryFn: applications.list })
  const sq = useQuery({ queryKey: ['scorecards'], queryFn: scorecards.list })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<F>({ resolver: zodResolver(schema) })

  const m = useMutation({
    mutationFn: (v: F) => {
      const matchingInterview = (iq.data ?? []).find(
        (i) => i.applicationId === v.applicationId && i.status !== 'Cancelled',
      )
      return scorecards.submit({
        applicationId: v.applicationId,
        interviewBusinessId: matchingInterview?.id,
        recommendation: v.recommendation,
        notes: v.notes,
        ratings: Object.fromEntries(RUBRIC.map((r) => [r.key, Number(v[r.key])])),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scorecards'] })
      qc.invalidateQueries({ queryKey: ['applications'] })
      saved('Scorecard submitted successfully')
      reset()
    },
    onError: (err: any) => {
      toast(err?.message || 'Failed to submit scorecard.', 'error')
    },
  })

  const w = watch()
  const vals = RUBRIC.map((r) => Number(w[r.key])).filter(Boolean)
  const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '–'

  const activeInterviews = (iq.data ?? []).filter((i) => i.status !== 'Cancelled')
  const ids = new Set(activeInterviews.map((i) => i.applicationId))

  const userRole = me.data?.role
  const isInterviewerOrAdmin = userRole === 'Admin' || userRole === 'Interviewer' || userRole === 'Hiring Manager'

  return (
    <>
      <PageHeader
        title="Scorecards"
        desc="Rate each criterion against the rubric and back your recommendation with evidence."
      />

      {!isInterviewerOrAdmin && me.data && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Role Permission Notice</p>
          <p className="mt-1 text-xs text-amber-800">
            You are signed in as <strong>{me.data.name}</strong> ({me.data.role}). Scorecard submission is reserved for assigned Interviewers (e.g. <em>Samir Qureshi</em>) or Administrators (<em>Meera Joshi</em>). Use the profile avatar menu in the top-right header to switch personas.
          </p>
        </div>
      )}

      <form noValidate onSubmit={handleSubmit((v) => m.mutate(v))} className="mb-8 grid gap-4 lg:grid-cols-3">
        <Card className="space-y-5 lg:col-span-2">
          <Field label="Candidate" error={errors.applicationId?.message}>
            <select className={inputCls} defaultValue="" {...register('applicationId')}>
              <option value="" disabled>
                Choose candidate…
              </option>
              {(aq.data ?? [])
                .filter((a) => ids.has(a.id))
                .map((a) => {
                  const int = activeInterviews.find((i) => i.applicationId === a.id)
                  return (
                    <option key={a.id} value={a.id}>
                      {a.candidateName} — {a.requisitionTitle} {int ? `(${int.title})` : ''}
                    </option>
                  )
                })}
            </select>
          </Field>

          {RUBRIC.map((r) => (
            <fieldset key={r.key}>
              <legend className="text-sm font-medium">{r.label}</legend>
              <p className="mb-1.5 text-xs text-muted">{r.hint}</p>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((l, i) => (
                  <label key={l}>
                    <input type="radio" value={i + 1} className="peer sr-only" {...register(r.key)} />
                    <span className="inline-block cursor-pointer rounded-lg border border-line bg-white px-3 py-1.5 text-sm peer-checked:border-accent peer-checked:bg-accent peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                      {l}
                    </span>
                  </label>
                ))}
              </div>
              {errors[r.key] && (
                <p role="alert" className="mt-1 text-xs text-red-700">
                  {errors[r.key]?.message}
                </p>
              )}
            </fieldset>
          ))}

          <Field label="Evidence and notes" error={errors.notes?.message}>
            <textarea
              rows={4}
              className={inputCls}
              placeholder="Detail observations, technical strengths/weaknesses, and rationale for your rating..."
              {...register('notes')}
            />
          </Field>
        </Card>

        <Card className="h-fit space-y-4">
          <div>
            <p className="text-sm text-muted">Average rating</p>
            <p className="text-4xl font-semibold">
              {avg}
              <span className="text-base text-muted"> / 4</span>
            </p>
          </div>
          <Field label="Recommendation" error={errors.recommendation?.message}>
            <select className={inputCls} defaultValue="" {...register('recommendation')}>
              <option value="" disabled>
                Choose recommendation…
              </option>
              {['Strong yes', 'Yes', 'No', 'Strong no'].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          <Button variant="primary" type="submit" className="w-full" disabled={m.isPending}>
            {m.isPending ? 'Submitting…' : 'Submit scorecard'}
          </Button>
        </Card>
      </form>

      <h2 className="mb-3 font-medium">Submitted scorecards</h2>
      <Async q={sq}>
        {(s) => (
          <DataTable
            csvName="scorecards"
            rows={s}
            cols={[
              {
                key: 'candidateName',
                header: 'Candidate',
                sort: (a, b) => a.candidateName.localeCompare(b.candidateName),
              },
              { key: 'interviewer', header: 'Interviewer' },
              {
                key: 'avg',
                header: 'Average',
                sort: (a, b) => avgOf(a.ratings) - avgOf(b.ratings),
                render: (r) => avgOf(r.ratings).toFixed(1),
              },
              {
                key: 'recommendation',
                header: 'Recommendation',
                render: (r) => (
                  <Badge tone={statusTone(/No/.test(r.recommendation) ? 'Reject' : 'Approved')}>
                    {r.recommendation}
                  </Badge>
                ),
              },
              { key: 'submittedAt', header: 'Submitted', render: (r) => fmtDate(r.submittedAt) },
            ]}
          />
        )}
      </Async>
    </>
  )
}

const avgOf = (r: Record<string, number>) => {
  const v = Object.values(r)
  return v.reduce((a, b) => a + b, 0) / (v.length || 1)
}
