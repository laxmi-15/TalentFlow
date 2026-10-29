import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { dataQuality } from '../api/services'
import { Async, Badge, Button, Card, DataTable, Field, PageHeader, inputCls } from '../components/ui'
import { downloadFile, fmtDate } from '../lib/csv'
import { saved } from '../lib/notify'

const schema = z.object({ rows: z.number().int('Whole numbers only.').min(100, 'Minimum 100 rows.').max(100000, 'Maximum 100,000 rows.'), seed: z.number().int('Whole numbers only.').min(0, 'Seed cannot be negative.') })
type F = z.infer<typeof schema>
export default function DataQuality() {
  const qc = useQueryClient(), q = useQuery({ queryKey: ['dq'], queryFn: dataQuality.reports })
  const { register, handleSubmit, formState: { errors } } = useForm<F>({ resolver: zodResolver(schema), defaultValues: { rows: 5000, seed: 42 } })
  const m = useMutation({ mutationFn: dataQuality.generate, onSuccess: () => { qc.invalidateQueries({ queryKey: ['dq'] }); qc.invalidateQueries({ queryKey: ['audit'] }); saved('Synthetic dataset generated and validated') } })
  return <><PageHeader title="Synthetic data and validation" desc="Generate synthetic hiring data and review automated validation checks. No real personal information is used." />
    <Card className="mb-6"><form noValidate onSubmit={handleSubmit((v) => m.mutate(v))} className="flex flex-wrap items-start gap-4"><Field label="Rows" error={errors.rows?.message}><input type="number" className={inputCls} {...register('rows', { valueAsNumber: true })} /></Field><Field label="Random seed" error={errors.seed?.message}><input type="number" className={inputCls} {...register('seed', { valueAsNumber: true })} /></Field><Button variant="primary" type="submit" className="mt-6" disabled={m.isPending}>{m.isPending ? 'Generating…' : 'Generate and validate'}</Button></form></Card>
    <Async q={q}>{(rs) => { const r = rs[0]; return !r ? null : <div className="space-y-6"><div className="grid gap-4 lg:grid-cols-2">
      <Card><div className="mb-3 flex items-center justify-between"><h2 className="font-medium">Latest report · {r.id}</h2><Button onClick={() => downloadFile(`${r.id}.json`, JSON.stringify(r, null, 2), 'application/json')}>Export JSON</Button></div><ul className="space-y-3">{r.checks.map((c) => { const p = (c.passed / c.total) * 100; return <li key={c.name} className="text-sm"><div className="flex justify-between"><span>{c.name}</span><Badge tone={p >= 99 ? 'green' : p >= 96 ? 'amber' : 'red'}>{p.toFixed(1)}%</Badge></div><div className="mt-1 h-1.5 rounded bg-sand"><div className="h-full rounded bg-accent" style={{ width: `${p}%` }} /></div></li> })}</ul></Card>
      <Card><h2 className="mb-3 font-medium">Failed rows by check</h2><div role="img" aria-label="Bar chart of failed rows per validation check" className="h-72"><ResponsiveContainer><BarChart data={r.checks.map((c, i) => ({ name: `C${i + 1}`, failed: c.total - c.passed }))}><CartesianGrid stroke="#e6e1d8" vertical={false} /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="failed" fill="#4f46e5" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></Card></div>
      <div><h2 className="mb-3 font-medium">Report history</h2><DataTable csvName="data-quality-reports" rows={rs.map((x) => ({ id: x.id, generatedAt: x.generatedAt, rows: x.rows, seed: x.seed, lowestPass: Math.min(...x.checks.map((c) => (c.passed / c.total) * 100)).toFixed(1) + '%' }))} cols={[{ key: 'id', header: 'Report' }, { key: 'generatedAt', header: 'Generated', render: (x) => fmtDate(x.generatedAt) }, { key: 'rows', header: 'Rows', sort: (a, b) => a.rows - b.rows }, { key: 'seed', header: 'Seed' }, { key: 'lowestPass', header: 'Lowest pass rate' }]} /></div></div> }}</Async></>
}
