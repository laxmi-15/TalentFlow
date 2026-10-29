import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { auth } from '../api/services'
import { BASE } from '../api/client'
import { ROLES_LIST, type Role } from '../api/types'
import { Async, Badge, Button, Card, DataTable, Field, PageHeader, Tabs, inputCls } from '../components/ui'
import { saved } from '../lib/notify'

const PERMS: Record<Role, string[]> = { Admin: ['Everything'], Recruiter: ['Candidates', 'Pipeline', 'Interviews', 'Offers (create)'], 'Hiring Manager': ['Requisitions', 'Scorecards', 'Pipeline (view)'], Interviewer: ['Scorecards', 'Own availability'], Approver: ['Approvals', 'Offers (decide)', 'Audit (view)'] }
const schema = z.object({ orgName: z.string().min(2, 'Enter an organisation name.'), timezone: z.string().min(3, 'Enter an IANA time zone, such as Europe/Berlin.'), requireOfferApproval: z.boolean() })
type F = z.infer<typeof schema>

export default function Admin() {
  const [tab, setTab] = useState('users'), qc = useQueryClient()
  const uq = useQuery({ queryKey: ['users'], queryFn: auth.users }), sq = useQuery({ queryKey: ['settings'], queryFn: auth.settings })
  const role = useMutation({ mutationFn: (v: { id: string; r: Role }) => auth.setRole(v.id, v.r), onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); saved('Role updated') } })
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<F>({ resolver: zodResolver(schema), values: sq.data })
  const save = useMutation({ mutationFn: auth.saveSettings, onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); saved('Settings saved') } })
  return <><PageHeader title="Users, roles and settings" desc="Manage who can do what. Role changes are recorded in the audit history." />
    <Tabs value={tab} onChange={setTab} tabs={[{ id: 'users', label: 'Users' }, { id: 'roles', label: 'Roles' }, { id: 'settings', label: 'Settings' }]} />
    {tab === 'users' && <Async q={uq}>{(us) => <DataTable csvName="users" rows={us} cols={[{ key: 'name', header: 'Name', sort: (a, b) => a.name.localeCompare(b.name) }, { key: 'email', header: 'Email' }, { key: 'role', header: 'Role', render: (u) => <select aria-label={`Role for ${u.name}`} value={u.role} onChange={(e) => role.mutate({ id: u.id, r: e.target.value as Role })} className={inputCls + ' w-auto'}>{ROLES_LIST.map((r) => <option key={r}>{r}</option>)}</select> }, { key: 'active', header: 'Status', render: (u) => <Badge tone={u.active ? 'green' : 'neutral'}>{u.active ? 'Active' : 'Deactivated'}</Badge> }]} />}</Async>}
    {tab === 'roles' && <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{ROLES_LIST.map((r) => <Card key={r}><h2 className="mb-2 font-medium">{r}</h2><ul className="flex flex-wrap gap-1">{PERMS[r].map((p) => <Badge key={p} tone="indigo">{p}</Badge>)}</ul></Card>)}<p className="text-xs text-muted md:col-span-3">Permission sets are display-only here; enforcement belongs to the backend.</p></div>}
    {tab === 'settings' && <Async q={sq}>{() => <Card className="max-w-xl"><form noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4"><Field label="Organisation name" error={errors.orgName?.message}><input className={inputCls} {...register('orgName')} /></Field><Field label="Time zone" error={errors.timezone?.message}><input className={inputCls} {...register('timezone')} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('requireOfferApproval')} />Require approval before any offer is sent</label>
      <p className="rounded-lg bg-sand p-3 text-xs text-muted">API base URL: <code>{BASE || 'not set (demo mode)'}</code>. Set this in <code>.env</code> as VITE_API_BASE_URL.</p>
      <Button variant="primary" type="submit" disabled={!isDirty || save.isPending}>{save.isPending ? 'Saving…' : 'Save settings'}</Button></form></Card>}</Async>}</>
}
