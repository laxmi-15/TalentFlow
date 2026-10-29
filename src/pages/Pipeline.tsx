import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Kanban, Table2 } from 'lucide-react'
import { applications } from '../api/services'
import { STAGES, type Application, type Stage } from '../api/types'
import { Async, Badge, Button, DataTable, PageHeader, Select, inputCls } from '../components/ui'
import { fmtDate } from '../lib/csv'
import { saved } from '../lib/notify'

export default function Pipeline() {
  const [view, setView] = useState<'board' | 'table'>('board'),
    [req, setReq] = useState(''),
    qc = useQueryClient()
  const q = useQuery({ queryKey: ['applications'], queryFn: applications.list })
  const m = useMutation({
    mutationFn: (v: { id: string; stage: Stage }) => applications.move(v.id, v.stage),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ['applications'] })
      saved(`${a.candidateName} moved to ${a.stage}`)
    },
  })
  const move = (a: Application, d: number) => {
    const s = STAGES[STAGES.indexOf(a.stage) + d]
    if (s) m.mutate({ id: a.id, stage: s })
  }

  const formatRec = (rec?: string | null) => {
    if (!rec) return null
    if (/StrongYes/i.test(rec)) return { label: 'Strong Yes', tone: 'green' as const }
    if (/StrongNo/i.test(rec)) return { label: 'Strong No', tone: 'red' as const }
    if (/Yes/i.test(rec)) return { label: 'Yes', tone: 'green' as const }
    if (/No/i.test(rec)) return { label: 'No', tone: 'red' as const }
    return { label: rec, tone: 'neutral' as const }
  }

  return (
    <>
      <PageHeader
        title="Pipeline"
        desc="Move candidates through stages. Changes apply to the application immediately."
        actions={
          <div role="group" aria-label="View" className="flex rounded-lg border border-line bg-white p-0.5">
            {([['board', 'Kanban', Kanban], ['table', 'Table', Table2]] as const).map(([v, l, I]) => (
              <button
                key={v}
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${view === v ? 'bg-accent text-white' : ''}`}
              >
                <I size={15} />
                {l}
              </button>
            ))}
          </div>
        }
      />
      <Async q={q}>
        {(rows) => {
          const f = rows.filter((r) => !req || r.requisitionId === req),
            reqs = [...new Set(rows.map((r) => r.requisitionId))]
          return view === 'table' ? (
            <DataTable
              csvName="pipeline"
              rows={f}
              toolbar={<Select label="Requisition" value={req} onChange={setReq} options={reqs} />}
              cols={[
                {
                  key: 'candidateName',
                  header: 'Candidate',
                  sort: (a, b) => a.candidateName.localeCompare(b.candidateName),
                  render: (r) => (
                    <Link className="font-medium text-accent" to={`/candidates/${r.candidateId}`}>
                      {r.candidateName}
                    </Link>
                  ),
                },
                { key: 'requisitionTitle', header: 'Requisition' },
                {
                  key: 'stage',
                  header: 'Stage',
                  sort: (a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage),
                  render: (r) => (
                    <select
                      aria-label={`Stage for ${r.candidateName}`}
                      value={r.stage}
                      onChange={(e) => m.mutate({ id: r.id, stage: e.target.value as Stage })}
                      className={inputCls + ' w-auto'}
                    >
                      {STAGES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  ),
                },
                {
                  key: 'score',
                  header: 'Scorecard Rating',
                  sort: (a, b) => Number(a.score ?? 0) - Number(b.score ?? 0),
                  render: (r) => {
                    const rec = formatRec(r.latestRecommendation)
                    const displayScore = r.avgRating != null ? r.avgRating : (r.score != null ? r.score : null)
                    return (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {displayScore != null ? (
                          <Badge tone="indigo">★ {displayScore} / 5</Badge>
                        ) : (
                          <Badge tone="neutral">No score</Badge>
                        )}
                        {rec && <Badge tone={rec.tone}>{rec.label}</Badge>}
                        {r.hasPendingReview && !rec && <Badge tone="amber">Pending Review</Badge>}
                      </div>
                    )
                  },
                },
                { key: 'updatedAt', header: 'Updated', render: (r) => fmtDate(r.updatedAt) },
              ]}
            />
          ) : (
            <>
              <div className="mb-3">
                <Select label="Requisition" value={req} onChange={setReq} options={reqs} />
              </div>
              <div className="flex gap-3 overflow-x-auto pb-3">
                {STAGES.map((s) => {
                  const col = f.filter((a) => a.stage === s)
                  return (
                    <section key={s} aria-label={`${s} column`} className="w-64 shrink-0 rounded-xl bg-sand p-2">
                      <h2 className="flex justify-between px-2 py-1.5 text-sm font-medium">
                        {s}
                        <Badge>{col.length}</Badge>
                      </h2>
                      <div className="max-h-[60vh] space-y-2 overflow-y-auto">
                        {col.map((a) => {
                          const rec = formatRec(a.latestRecommendation)
                          const displayScore = a.avgRating != null ? a.avgRating : (a.score != null ? a.score : null)
                          return (
                            <article key={a.id} className="rounded-lg border border-line bg-white p-3 text-sm">
                              <Link to={`/candidates/${a.candidateId}`} className="font-medium text-accent">
                                {a.candidateName}
                              </Link>
                              <p className="text-xs text-muted">{a.requisitionTitle}</p>
                              <div className="mt-2 flex items-center justify-between">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {displayScore != null ? (
                                    <Badge tone="indigo">Score {displayScore}</Badge>
                                  ) : (
                                    <Badge tone="neutral">No score</Badge>
                                  )}
                                  {rec && <Badge tone={rec.tone}>{rec.label}</Badge>}
                                  {a.hasPendingReview && !rec && <Badge tone="amber">Pending Review</Badge>}
                                </div>
                                <div className="flex">
                                  <Button
                                    variant="ghost"
                                    className="!p-1.5"
                                    aria-label={`Move ${a.candidateName} to previous stage`}
                                    disabled={s === STAGES[0] || m.isPending}
                                    onClick={() => move(a, -1)}
                                  >
                                    <ArrowLeft size={14} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    className="!p-1.5"
                                    aria-label={`Move ${a.candidateName} to next stage`}
                                    disabled={s === STAGES[5] || m.isPending}
                                    onClick={() => move(a, 1)}
                                  >
                                    <ArrowRight size={14} />
                                  </Button>
                                </div>
                              </div>
                            </article>
                          )
                        })}
                        {!col.length && (
                          <p className="px-2 py-6 text-center text-xs text-muted">No candidates in this stage</p>
                        )}
                      </div>
                    </section>
                  )
                })}
              </div>
            </>
          )
        }}
      </Async>
    </>
  )
}
