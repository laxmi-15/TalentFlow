import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { applications, interviews } from '../api/services'
import type { Interview } from '../api/types'
import { Async, Badge, Button, Card, DataTable, Dialog, Field, PageHeader, Tabs, cn, inputCls, statusTone, toast } from '../components/ui'
import { fmtDate, fmtTime } from '../lib/csv'
import { saved } from '../lib/notify'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], BLOCKS = ['Morning', 'Midday', 'Afternoon'], H0 = 8, HOURS = 10, ROW = 48
const schema = z.object({
  applicationId: z.string().min(1, 'Choose a candidate.'),
  panelId: z.string().min(1, 'Choose a panel.'),
  start: z.string().min(1, 'Pick a date and time.').refine((v) => new Date(v).getTime() > Date.now(), 'Choose a time in the future.'),
  durationMin: z.number().min(15, 'At least 15 minutes.').max(240, 'At most 4 hours.'),
})
type F = z.infer<typeof schema>
const startOfWeek = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }

export default function Interviews() {
  const [tab, setTab] = useState('cal'), [view, setView] = useState<'week' | 'agenda'>('week'), [anchor, setAnchor] = useState(startOfWeek(new Date())), [sel, setSel] = useState<Interview | null>(null), [open, setOpen] = useState(false), qc = useQueryClient()
  const iq = useQuery({ queryKey: ['interviews'], queryFn: interviews.list }), vq = useQuery({ queryKey: ['interviewers'], queryFn: interviews.interviewers }), aq = useQuery({ queryKey: ['applications'], queryFn: applications.list }), pq = useQuery({ queryKey: ['panels'], queryFn: interviews.panels })
  const { register, handleSubmit, reset, formState: { errors } } = useForm<F>({ resolver: zodResolver(schema), defaultValues: { durationMin: 60 } })
  const sched = useMutation({
    mutationFn: interviews.schedule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interviews'] })
      qc.invalidateQueries({ queryKey: ['applications'] })
      saved('Interview scheduled')
      setOpen(false)
      reset()
    },
    onError: (err: any) => toast(err?.message || 'Failed to schedule interview', 'error'),
  })
  const cancel = useMutation({ mutationFn: interviews.cancel, onSuccess: () => { qc.invalidateQueries({ queryKey: ['interviews'] }); saved('Interview cancelled'); setSel(null) } })
  const slot = useMutation({ mutationFn: (v: { id: string; d: number; b: number; free: boolean }) => interviews.toggleSlot(v.id, v.d, v.b, v.free), onSuccess: () => qc.invalidateQueries({ queryKey: ['interviewers'] }) })
  const shift = (n: number) => { const d = new Date(anchor); d.setDate(d.getDate() + n * 7); setAnchor(d) }

  const eligibleCandidates = (aq.data ?? []).filter((a) => a.stage === 'Screen' || a.stage === 'Interview' || a.stage === 'Final')
  const pendingCandidates = (aq.data ?? []).filter((a) => a.stage === 'Applied')

  return <>
    <PageHeader title="Interviews" desc="Calendar of scheduled interviews and interviewer availability." actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} />Schedule interview</Button>} />
    <Tabs value={tab} onChange={setTab} tabs={[{ id: 'cal', label: 'Calendar' }, { id: 'avail', label: 'Interviewer availability' }]} />
    {tab === 'cal' && <Async q={iq}>{(all) => { const list = all.filter((i) => i.status !== 'Cancelled'), end = new Date(anchor); end.setDate(end.getDate() + 7)
      const wk = list.filter((i) => new Date(i.start) >= anchor && new Date(i.start) < end)
      return <><div className="mb-3 flex flex-wrap items-center gap-2"><Button aria-label="Previous week" onClick={() => shift(-1)}><ChevronLeft size={16} /></Button><Button onClick={() => setAnchor(startOfWeek(new Date()))}>Today</Button><Button aria-label="Next week" onClick={() => shift(1)}><ChevronRight size={16} /></Button><span className="text-sm font-medium">Week of {fmtDate(anchor.toISOString())}</span>
        <div role="group" aria-label="Calendar view" className="ml-auto flex rounded-lg border border-line bg-white p-0.5">{(['week', 'agenda'] as const).map((v) => <button key={v} aria-pressed={view === v} onClick={() => setView(v)} className={cn('rounded-md px-3 py-1.5 text-sm capitalize', view === v && 'bg-accent text-white')}>{v}</button>)}</div></div>
        {view === 'agenda' ? <DataTable csvName="interviews" rows={wk.length ? wk : list} onRow={setSel} empty="No interviews scheduled" cols={[{ key: 'start', header: 'When', sort: (a, b) => a.start.localeCompare(b.start), render: (r) => `${fmtDate(r.start)} ${fmtTime(r.start)}` }, { key: 'candidateName', header: 'Candidate' }, { key: 'title', header: 'Type' }, { key: 'panel', header: 'Panel', render: (r) => r.panel.join(', ') }, { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> }]} />
        : <Card className="overflow-x-auto !p-0"><div className="grid min-w-[720px] grid-cols-[56px_repeat(5,1fr)] text-xs">
          <div />{DAYS.map((d, i) => { const dd = new Date(anchor); dd.setDate(dd.getDate() + i); return <div key={d} className="border-l border-line p-2 text-center font-medium">{d} {dd.getDate()}</div> })}
          <div>{Array.from({ length: HOURS }, (_, h) => <div key={h} style={{ height: ROW }} className="pr-2 pt-1 text-right text-muted">{H0 + h}:00</div>)}</div>
          {DAYS.map((_, di) => <div key={di} className="relative border-l border-line" style={{ height: ROW * HOURS }}>{Array.from({ length: HOURS }, (_, h) => <div key={h} style={{ height: ROW }} className="border-t border-line/60" />)}
            {wk.filter((i) => (new Date(i.start).getDay() + 6) % 7 === di).map((i) => { const s = new Date(i.start), dur = (new Date(i.end).getTime() - s.getTime()) / 3600000; return <button key={i.id} onClick={() => setSel(i)} style={{ top: (s.getHours() + s.getMinutes() / 60 - H0) * ROW, height: Math.max(dur * ROW - 2, 22) }} className={cn('absolute inset-x-1 overflow-hidden rounded-md border px-1.5 py-1 text-left leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-accent', i.status === 'Completed' ? 'border-line bg-sand' : 'border-indigo-200 bg-accent-soft text-indigo-900')}><span className="font-medium">{fmtTime(i.start)}</span> {i.candidateName}</button> })}</div>)}
        </div>{!wk.length && <p className="p-4 text-center text-sm text-muted">No interviews this week. Use the arrows or schedule one.</p>}</Card>}</> }}</Async>}
    {tab === 'avail' && <Async q={vq}>{(vs) => <Card className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><caption className="mb-3 text-left text-sm text-muted">Select a block to mark an interviewer free or busy.</caption><thead><tr><th scope="col" className="text-left">Interviewer</th>{DAYS.map((d) => <th scope="col" key={d} colSpan={1} className="px-1 text-center">{d}</th>)}</tr></thead>
      <tbody>{vs.map((v) => <tr key={v.id} className="border-t border-line"><th scope="row" className="py-2 pr-3 text-left font-medium">{v.name}<span className="block text-xs font-normal text-muted">{v.team}</span></th>{v.availability.map((day, di) => <td key={di} className="px-1 py-2"><div className="flex justify-center gap-1">{day.map((free, bi) => <button key={bi} aria-pressed={free} aria-label={`${v.name} ${DAYS[di]} ${BLOCKS[bi]}: ${free ? 'free' : 'busy'}`} title={BLOCKS[bi]} onClick={() => slot.mutate({ id: v.id, d: di, b: bi, free: !free })} className={cn('h-6 w-6 rounded border focus:outline-none focus-visible:ring-2 focus-visible:ring-accent', free ? 'border-emerald-300 bg-emerald-100' : 'border-line bg-sand')} />)}</div></td>)}</tr>)}</tbody></table><p className="mt-3 text-xs text-muted">Each day shows three blocks: morning, midday, afternoon. Green means free.</p></Card>}</Async>}
    <Dialog open={!!sel} onClose={() => setSel(null)} title={sel?.title ?? ''}>{sel && <div className="space-y-3 text-sm"><p><strong>{sel.candidateName}</strong> · {fmtDate(sel.start)}, {fmtTime(sel.start)}–{fmtTime(sel.end)}</p><p>Panel: {sel.panel.join(', ')}</p><Badge tone={statusTone(sel.status)}>{sel.status}</Badge>
      <div className="flex justify-end gap-2"><Button onClick={() => setSel(null)}>Close</Button>{sel.status === 'Scheduled' && <Button variant="danger" disabled={cancel.isPending} onClick={() => cancel.mutate(sel.id)}>Cancel interview</Button>}</div></div>}</Dialog>
    <Dialog open={open} onClose={() => setOpen(false)} title="Schedule interview"><form noValidate onSubmit={handleSubmit((v) => sched.mutate(v))} className="space-y-4">
      <Field label="Candidate" error={errors.applicationId?.message}>
        <select className={inputCls} defaultValue="" {...register('applicationId')}>
          <option value="" disabled>Choose candidate…</option>
          {eligibleCandidates.length > 0 && (
            <optgroup label="Eligible Candidates (Screen, Interview, Final)">
              {eligibleCandidates.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.candidateName} — {a.requisitionTitle} ({a.stage})
                </option>
              ))}
            </optgroup>
          )}
          {pendingCandidates.length > 0 && (
            <optgroup label="Pending Review (Must advance in Pipeline first)">
              {pendingCandidates.map((a) => (
                <option key={a.id} value={a.id} disabled>
                  {a.candidateName} — {a.requisitionTitle} (Applied — advance to Screen in Pipeline)
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </Field>
      <p className="text-xs text-muted -mt-2">
        Candidates in <strong>Screen</strong>, <strong>Interview</strong>, or <strong>Final</strong> stage are eligible for interview scheduling. Candidates in <strong>Applied</strong> can be advanced in the <Link to="/pipeline" className="text-accent underline font-medium">Pipeline</Link>.
      </p>
      <Field label="Panel" error={errors.panelId?.message}><select className={inputCls} defaultValue="" {...register('panelId')}><option value="" disabled>Choose panel…</option>{(pq.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-4"><Field label="Start" error={errors.start?.message}><input type="datetime-local" className={inputCls} {...register('start')} /></Field><Field label="Duration (minutes)" error={errors.durationMin?.message}><input type="number" className={inputCls} {...register('durationMin', { valueAsNumber: true })} /></Field></div>
      <div className="flex justify-end gap-2"><Button type="button" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" type="submit" disabled={sched.isPending}>{sched.isPending ? 'Scheduling…' : 'Schedule'}</Button></div></form></Dialog></>
}
