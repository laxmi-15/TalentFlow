import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus } from 'lucide-react'
import { applications, offers } from '../api/services'
import { Approvals } from '../components/Approvals'
import { Async, Badge, Button, DataTable, Dialog, Field, PageHeader, Select, Tabs, inputCls, statusTone } from '../components/ui'
import { money } from '../lib/csv'
import { saved } from '../lib/notify'

const schema = z.object({ applicationId: z.string().min(1, 'Choose a candidate.'), base: z.number().min(20000, 'Enter an annual base of at least $20,000.'), bonusPct: z.number().min(0, 'Cannot be negative.').max(50, 'Cap is 50%.') })
type F = z.infer<typeof schema>
const bandState = (o: { base: number; bandMin: number; bandMax: number }) => (o.base > o.bandMax ? 'Above band' : o.base < o.bandMin ? 'Below band' : 'In band')

export default function Offers() {
  const [tab, setTab] = useState('offers'), [st, setSt] = useState(''), [open, setOpen] = useState(false), qc = useQueryClient()
  const oq = useQuery({ queryKey: ['offers'], queryFn: offers.list }), aq = useQuery({ queryKey: ['applications'], queryFn: applications.list })
  const { register, handleSubmit, reset, formState: { errors } } = useForm<F>({ resolver: zodResolver(schema), defaultValues: { bonusPct: 10 } })
  const m = useMutation({ mutationFn: offers.create, onSuccess: () => { qc.invalidateQueries(); saved('Offer created and sent for approval'); setOpen(false); reset() } })
  return <><PageHeader title="Offers and compensation" desc="Every offer is checked against its requisition band and routed for approval." actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} />New offer</Button>} />
    <Tabs value={tab} onChange={setTab} tabs={[{ id: 'offers', label: 'Offers' }, { id: 'approvals', label: 'Approval queue' }]} />
    {tab === 'approvals' ? <Approvals type="Offer" /> : <Async q={oq}>{(rows) => <DataTable csvName="offers" rows={rows.filter((o) => !st || o.status === st)} toolbar={<Select label="Status" value={st} onChange={setSt} options={['Pending approval', 'Approved', 'Sent', 'Rejected']} />}
      cols={[{ key: 'candidateName', header: 'Candidate', sort: (a, b) => a.candidateName.localeCompare(b.candidateName) }, { key: 'role', header: 'Role' }, { key: 'base', header: 'Base', sort: (a, b) => a.base - b.base, render: (r) => money(r.base) }, { key: 'bonusPct', header: 'Bonus', render: (r) => `${r.bonusPct}%` }, { key: 'band', header: 'Band', render: (r) => <span className="text-muted">{money(r.bandMin)} – {money(r.bandMax)}</span> }, { key: 'check', header: 'Band check', render: (r) => <Badge tone={bandState(r) === 'In band' ? 'green' : 'red'}>{bandState(r)}</Badge> }, { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> }]} />}</Async>}
    <Dialog open={open} onClose={() => setOpen(false)} title="New offer"><form noValidate onSubmit={handleSubmit((v) => m.mutate(v))} className="space-y-4">
      <Field label="Candidate" error={errors.applicationId?.message}><select className={inputCls} defaultValue="" {...register('applicationId')}><option value="" disabled>Choose…</option>{(aq.data ?? []).filter((a) => a.stage === 'Final' || a.stage === 'Offer').map((a) => <option key={a.id} value={a.id}>{a.candidateName} — {a.requisitionTitle}</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-4"><Field label="Annual base (USD)" error={errors.base?.message}><input type="number" className={inputCls} {...register('base', { valueAsNumber: true })} /></Field><Field label="Bonus target (%)" error={errors.bonusPct?.message}><input type="number" className={inputCls} {...register('bonusPct', { valueAsNumber: true })} /></Field></div>
      <p className="text-xs text-muted">Offers outside the requisition band are flagged on the list and in Exceptions.</p>
      <div className="flex justify-end gap-2"><Button type="button" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" type="submit" disabled={m.isPending}>{m.isPending ? 'Creating…' : 'Create offer'}</Button></div></form></Dialog></>
}
