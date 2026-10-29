import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, X } from 'lucide-react'
import { interviews } from '../api/services'
import { Async, Button, Card, Dialog, Field, PageHeader, EmptyState, inputCls } from '../components/ui'
import { saved } from '../lib/notify'

const schema = z.object({ name: z.string().min(3, 'Name the panel (3+ characters).'), focus: z.string().min(3, 'Describe the focus areas.'), members: z.array(z.string()).min(2, 'Choose at least two panelists.') })
type F = z.infer<typeof schema>
export default function Panels() {
  const [open, setOpen] = useState(false), qc = useQueryClient()
  const pq = useQuery({ queryKey: ['panels'], queryFn: interviews.panels }), vq = useQuery({ queryKey: ['interviewers'], queryFn: interviews.interviewers })
  const { register, handleSubmit, reset, formState: { errors } } = useForm<F>({ resolver: zodResolver(schema), defaultValues: { members: [] } })
  const create = useMutation({ mutationFn: interviews.createPanel, onSuccess: () => { qc.invalidateQueries({ queryKey: ['panels'] }); saved('Panel created'); setOpen(false); reset() } })
  const remove = useMutation({ mutationFn: (v: { id: string; m: string }) => interviews.removeMember(v.id, v.m), onSuccess: () => { qc.invalidateQueries({ queryKey: ['panels'] }); saved('Panelist removed') } })
  return <><PageHeader title="Interview panels" desc="Reusable groups of interviewers with a clear focus." actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} />New panel</Button>} />
    <Async q={pq}>{(ps) => ps.length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{ps.map((p) => <Card key={p.id}><h2 className="font-medium">{p.name}</h2><p className="mb-3 text-sm text-muted">{p.focus}</p><ul className="space-y-1.5">{p.members.map((m) => <li key={m} className="flex items-center justify-between rounded-lg bg-sand px-3 py-1.5 text-sm">{m}<button aria-label={`Remove ${m} from ${p.name}`} disabled={p.members.length <= 2 || remove.isPending} title={p.members.length <= 2 ? 'A panel needs at least two members' : undefined} onClick={() => remove.mutate({ id: p.id, m })} className="rounded p-0.5 hover:bg-white disabled:opacity-40"><X size={14} /></button></li>)}</ul></Card>)}</div> : <EmptyState title="No panels yet" hint="Create a panel to reuse it when scheduling." />}</Async>
    <Dialog open={open} onClose={() => setOpen(false)} title="New panel"><form noValidate onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-4">
      <Field label="Panel name" error={errors.name?.message}><input className={inputCls} {...register('name')} /></Field><Field label="Focus areas" error={errors.focus?.message}><input className={inputCls} {...register('focus')} /></Field>
      <fieldset><legend className="mb-1 text-sm font-medium">Panelists</legend><div className="grid grid-cols-2 gap-1.5">{(vq.data ?? []).map((v) => <label key={v.id} className="flex items-center gap-2 text-sm"><input type="checkbox" value={v.name} {...register('members')} />{v.name}</label>)}</div>{errors.members && <p role="alert" className="mt-1 text-xs text-red-700">{errors.members.message}</p>}</fieldset>
      <div className="flex justify-end gap-2"><Button type="button" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" type="submit" disabled={create.isPending}>Create panel</Button></div></form></Dialog></>
}
