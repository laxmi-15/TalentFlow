import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { approvals } from '../api/services'
import type { Approval } from '../api/types'
import { fmtDate } from '../lib/csv'
import { saved } from '../lib/notify'
import { Async, Badge, Button, DataTable, Dialog, Field, Select, inputCls, statusTone } from './ui'

const schema = z.object({ reason: z.string().min(5, 'Give a reason of at least 5 characters so the audit trail is useful.') })
export function Approvals({ type }: { type: 'Requisition' | 'Offer' }) {
  const qc = useQueryClient(), q = useQuery({ queryKey: ['approvals'], queryFn: approvals.list })
  const [target, setTarget] = useState<{ a: Approval; d: 'Approved' | 'Rejected' } | null>(null), [status, setStatus] = useState('')
  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })
  const m = useMutation({ mutationFn: (v: { reason: string }) => approvals.decide(target!.a.id, target!.d, v.reason), onSuccess: () => { qc.invalidateQueries(); saved(`${type} ${target!.d.toLowerCase()}`); setTarget(null); reset() } })
  return <Async q={q}>{(all) => <>
    <DataTable csvName={`${type.toLowerCase()}-approvals`} rows={all.filter((a) => a.type === type && (!status || a.status === status))} toolbar={<Select label="Status" value={status} onChange={setStatus} options={['Pending', 'Approved', 'Rejected']} />}
      cols={[{ key: 'subject', header: 'Subject', sort: (a, b) => a.subject.localeCompare(b.subject) }, { key: 'requestedBy', header: 'Requested by' }, { key: 'createdAt', header: 'Requested', render: (r) => fmtDate(r.createdAt), sort: (a, b) => a.createdAt.localeCompare(b.createdAt) }, { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
        { key: 'act', header: 'Decision', render: (r) => r.status === 'Pending' ? <div className="flex gap-2"><Button onClick={() => setTarget({ a: r, d: 'Approved' })}>Approve</Button><Button variant="danger" onClick={() => setTarget({ a: r, d: 'Rejected' })}>Reject</Button></div> : <span className="text-xs text-muted">{r.reason}</span> }]} />
    <Dialog open={!!target} onClose={() => { setTarget(null); reset() }} title={`${target?.d === 'Approved' ? 'Approve' : 'Reject'} ${type.toLowerCase()}`}>
      <form onSubmit={handleSubmit((v) => m.mutate(v))} className="space-y-4"><p className="text-sm text-muted">{target?.a.subject}</p>
        <Field label="Reason" error={errors.reason?.message}><textarea rows={3} className={inputCls} {...register('reason')} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" onClick={() => setTarget(null)}>Cancel</Button><Button variant="primary" type="submit" disabled={m.isPending}>{m.isPending ? 'Saving…' : `Confirm ${target?.d === 'Approved' ? 'approval' : 'rejection'}`}</Button></div></form>
    </Dialog></>}</Async>
}
