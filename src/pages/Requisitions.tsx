import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus } from 'lucide-react'
import { requisitions } from '../api/services'
import { Approvals } from '../components/Approvals'
import { Async, Badge, Button, DataTable, Dialog, Field, PageHeader, Tabs, inputCls, statusTone } from '../components/ui'
import { fmtDate, money } from '../lib/csv'
import { saved } from '../lib/notify'

const schema = z.object({ title: z.string().min(3, 'Enter a job title (3+ characters).'), department: z.string().min(1, 'Choose a department.'), location: z.string().min(2, 'Enter a location.'), headcount: z.number().int().min(1, 'At least 1 hire.').max(50, 'At most 50 hires.'), bandMin: z.number().min(1, 'Enter the band minimum.'), bandMax: z.number().min(1, 'Enter the band maximum.') }).refine((v) => v.bandMax > v.bandMin, { path: ['bandMax'], message: 'Band maximum must be above the minimum.' })
type F = z.infer<typeof schema>
const DEPTS = ['Engineering', 'Design', 'Analytics', 'Sales', 'People']

export default function Requisitions() {
  const [tab, setTab] = useState('list'), [status, setStatus] = useState('All'), [open, setOpen] = useState(false), qc = useQueryClient()
  const q = useQuery({ queryKey: ['requisitions'], queryFn: requisitions.list })
  const { register, handleSubmit, reset, formState: { errors } } = useForm<F>({ resolver: zodResolver(schema) })
  const m = useMutation({ mutationFn: requisitions.create, onSuccess: () => { qc.invalidateQueries(); saved('Requisition submitted for approval'); setOpen(false); reset() } })
  const sts = ['All', 'Pending approval', 'Open', 'Draft', 'Closed', 'Rejected']
  return <>
    <PageHeader title="Requisitions" desc="Plan headcount, set compensation bands and route requests for approval." actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} />New requisition</Button>} />
    <Tabs value={tab} onChange={setTab} tabs={[{ id: 'list', label: 'Requisitions' }, { id: 'approvals', label: 'Approval queue' }]} />
    {tab === 'approvals' ? <Approvals type="Requisition" /> : <Async q={q}>{(rows) => <>
      <div className="mb-3 flex flex-wrap gap-2">{sts.map((s) => <button key={s} aria-pressed={status === s} onClick={() => setStatus(s)} className={`rounded-full border px-3 py-1 text-sm ${status === s ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-white'}`}>{s}{s !== 'All' && ` (${rows.filter((r) => r.status === s).length})`}</button>)}</div>
      <DataTable csvName="requisitions" rows={rows.filter((r) => status === 'All' || r.status === status)} cols={[{ key: 'id', header: 'ID', sort: (a, b) => a.id.localeCompare(b.id) }, { key: 'title', header: 'Role', sort: (a, b) => a.title.localeCompare(b.title) }, { key: 'department', header: 'Department' }, { key: 'location', header: 'Location' }, { key: 'headcount', header: 'Heads', sort: (a, b) => a.headcount - b.headcount }, { key: 'band', header: 'Band', render: (r) => `${money(r.bandMin)} – ${money(r.bandMax)}` }, { key: 'createdAt', header: 'Created', render: (r) => fmtDate(r.createdAt), sort: (a, b) => a.createdAt.localeCompare(b.createdAt) }, { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> }]} /></>}</Async>}
    <Dialog open={open} onClose={() => setOpen(false)} title="New requisition">
      <form onSubmit={handleSubmit((v) => m.mutate(v))} className="grid grid-cols-2 gap-4" noValidate>
        <div className="col-span-2"><Field label="Job title" error={errors.title?.message}><input className={inputCls} {...register('title')} /></Field></div>
        <Field label="Department" error={errors.department?.message}><select className={inputCls} defaultValue="" {...register('department')}><option value="" disabled>Choose…</option>{DEPTS.map((d) => <option key={d}>{d}</option>)}</select></Field>
        <Field label="Location" error={errors.location?.message}><input className={inputCls} {...register('location')} /></Field>
        <Field label="Headcount" error={errors.headcount?.message}><input type="number" className={inputCls} {...register('headcount', { valueAsNumber: true })} /></Field><div />
        <Field label="Band minimum (USD)" error={errors.bandMin?.message}><input type="number" className={inputCls} {...register('bandMin', { valueAsNumber: true })} /></Field>
        <Field label="Band maximum (USD)" error={errors.bandMax?.message}><input type="number" className={inputCls} {...register('bandMax', { valueAsNumber: true })} /></Field>
        <div className="col-span-2 flex justify-end gap-2"><Button type="button" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" type="submit" disabled={m.isPending}>{m.isPending ? 'Submitting…' : 'Submit for approval'}</Button></div>
      </form></Dialog></>
}
