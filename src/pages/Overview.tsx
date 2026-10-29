import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { analytics, anomalies } from '../api/services'
import { Async, Badge, Card, PageHeader, Select, statusTone } from '../components/ui'
import { Link } from 'react-router-dom'

const COLORS = ['#4f46e5', '#818cf8', '#0f1b3d', '#a8a29e', '#c7c3ba']
export default function Overview() {
  const [days, setDays] = useState('30')
  const q = useQuery({ queryKey: ['analytics', days], queryFn: () => analytics.overview(Number(days)) })
  const an = useQuery({ queryKey: ['anomalies'], queryFn: anomalies.list })
  return <>
    <PageHeader title="Overview" desc="Hiring health across open requisitions, funnel conversion and sourcing." actions={<select aria-label="Date range" value={days} onChange={(e) => setDays(e.target.value)} className="rounded-lg border border-line bg-white px-3 py-2 text-sm"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select>} />
    <Async q={q}>{(d) => <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{d.kpis.map((k) => <Card key={k.label}><p className="text-sm text-muted">{k.label}</p><p className="mt-1 text-3xl font-semibold">{k.value}</p><p className={k.up ? 'mt-1 text-xs text-emerald-700' : 'mt-1 text-xs text-amber-800'}>{k.delta}</p></Card>)}</div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><h2 className="mb-3 font-medium">Applications and hires by week</h2><div role="img" aria-label="Line chart of weekly applications and hires" className="h-64"><ResponsiveContainer><LineChart data={d.trend}><CartesianGrid stroke="#e6e1d8" vertical={false} /><XAxis dataKey="week" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Legend /><Line dataKey="applications" stroke="#4f46e5" strokeWidth={2} dot={false} /><Line dataKey="hires" stroke="#0f1b3d" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div></Card>
        <Card><h2 className="mb-3 font-medium">Source mix</h2><div role="img" aria-label="Donut chart of candidate sources" className="h-64"><ResponsiveContainer><PieChart><Pie data={d.sources} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>{d.sources.map((_, i) => <Cell key={i} fill={COLORS[i % 5]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><h2 className="mb-3 font-medium">Funnel (reached stage or later)</h2><div role="img" aria-label="Bar chart of candidates by pipeline stage" className="h-60"><ResponsiveContainer><BarChart data={d.funnel}><CartesianGrid stroke="#e6e1d8" vertical={false} /><XAxis dataKey="stage" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
        <Card><div className="mb-3 flex justify-between"><h2 className="font-medium">Needs attention</h2><Link to="/exceptions" className="text-sm text-accent">View all</Link></div>
          <Async q={an}>{(a) => <ul className="space-y-3">{a.filter((x) => x.status !== 'Resolved').slice(0, 4).map((x) => <li key={x.id} className="text-sm"><Badge tone={statusTone(x.severity)}>{x.severity}</Badge> <span className="font-medium">{x.type}</span><p className="text-muted">{x.detail}</p></li>)}</ul>}</Async></Card>
      </div></div>}</Async></>
}
