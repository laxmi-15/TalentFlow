import { type ReactNode, type ButtonHTMLAttributes, useEffect, useId, useMemo, useRef, useState } from 'react'
import { X, ChevronUp, ChevronDown, Download, Search, Inbox, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import type { UseQueryResult } from '@tanstack/react-query'
import { downloadFile, toCsv } from '../lib/csv'

export const cn = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')
export const inputCls = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-navy placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent'

type BV = 'primary' | 'secondary' | 'ghost' | 'danger'
export function Button({ variant = 'secondary', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BV }) {
  const v: Record<BV, string> = { primary: 'bg-accent text-white hover:bg-indigo-700', secondary: 'bg-white border border-line text-navy hover:bg-sand', ghost: 'text-navy hover:bg-sand', danger: 'bg-white border border-red-200 text-red-700 hover:bg-red-50' }
  return <button {...p} className={cn('inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:pointer-events-none', v[variant], className)} />
}
export const Card = ({ children, className }: { children: ReactNode; className?: string }) => <section className={cn('rounded-xl border border-line bg-white p-5', className)}>{children}</section>
const tones = { neutral: 'bg-sand text-navy', indigo: 'bg-accent-soft text-indigo-800', green: 'bg-emerald-50 text-emerald-800', amber: 'bg-amber-50 text-amber-900', red: 'bg-red-50 text-red-800' }
export const Badge = ({ children, tone = 'neutral' }: { children: ReactNode; tone?: keyof typeof tones }) => <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>
export const statusTone = (s: string): keyof typeof tones => (/Approved|Open|Hired|Sent|Completed|Resolved|Pass/.test(s) ? 'green' : /Pending|Investigating|Medium|Draft|Scheduled/.test(s) ? 'amber' : /Reject|High|Cancel/.test(s) ? 'red' : 'neutral')

export function PageHeader({ title, desc, actions }: { title: string; desc?: string; actions?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight">{title}</h1>{desc && <p className="mt-1 max-w-2xl text-sm text-muted">{desc}</p>}</div><div className="flex gap-2">{actions}</div></div>
}
export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return <label className="block text-sm"><span className="mb-1 block font-medium">{label}</span>{children}{error && <span role="alert" className="mt-1 block text-xs text-red-700">{error}</span>}</label>
}
export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string; count?: number }[]; value: string; onChange: (v: string) => void }) {
  return <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-line">{tabs.map((t) => <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={cn('-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent', value === t.id ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-navy')}>{t.label}{t.count !== undefined && <span className="ml-1.5 text-xs">({t.count})</span>}</button>)}</div>
}

export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null), id = useId()
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close() }, [open])
  return <dialog ref={ref} aria-labelledby={id} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose() }} className="m-auto w-[min(560px,92vw)] rounded-2xl border border-line p-0 text-navy shadow-xl backdrop:bg-navy/40">
    {open && <div className="p-6"><div className="mb-4 flex items-start justify-between"><h2 id={id} className="text-lg font-semibold">{title}</h2><button aria-label="Close dialog" onClick={onClose} className="rounded p-1 hover:bg-sand focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><X size={18} /></button></div>{children}</div>}
  </dialog>
}

type TT = { id: number; msg: string; kind: 'success' | 'error' | 'info' }
const subs = new Set<(t: TT) => void>(); let tn = 0
export const toast = (msg: string, kind: TT['kind'] = 'success') => subs.forEach((f) => f({ id: ++tn, msg, kind }))
export function ToastHost() {
  const [ts, set] = useState<TT[]>([])
  useEffect(() => { const f = (t: TT) => { set((p) => [...p, t]); setTimeout(() => set((p) => p.filter((x) => x.id !== t.id)), 5000) }; subs.add(f); return () => { subs.delete(f) } }, [])
  return <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-[60] flex max-w-sm flex-col gap-2">{ts.map((t) => <div key={t.id} className={cn('rounded-lg border px-4 py-3 text-sm shadow-lg', t.kind === 'error' ? 'border-red-200 bg-red-50 text-red-900' : t.kind === 'info' ? 'border-line bg-white' : 'border-emerald-200 bg-emerald-50 text-emerald-900')}>{t.msg}</div>)}</div>
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return <div className="flex flex-col items-center py-12 text-center"><Inbox className="mb-2 text-muted" /><p className="font-medium">{title}</p>{hint && <p className="mt-1 text-sm text-muted">{hint}</p>}</div>
}
export function Async<D>({ q, children }: { q: UseQueryResult<D>; children: (d: D) => ReactNode }) {
  if (q.isPending) return <div aria-busy="true" className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-sand" />)}<span className="sr-only">Loading</span></div>
  if (q.isError) return <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><AlertCircle size={18} /><div><p className="font-medium">Could not load this data</p><p>{q.error instanceof Error ? q.error.message : 'Unknown error'}</p><Button className="mt-2" onClick={() => q.refetch()}>Try again</Button></div></div>
  return <>{children(q.data)}</>
}

export interface Col<R> { key: string; header: string; render?: (r: R) => ReactNode; sort?: (a: R, b: R) => number }
export function DataTable<R extends { id: string }>({ rows, cols, pageSize = 8, toolbar, csvName, onRow, empty = 'Nothing matches these filters' }: { rows: R[]; cols: Col<R>[]; pageSize?: number; toolbar?: ReactNode; csvName: string; onRow?: (r: R) => void; empty?: string }) {
  const [q, setQ] = useState(''), [page, setPage] = useState(0), [sort, setSort] = useState<{ k: string; d: 1 | -1 } | null>(null)
  const data = useMemo(() => {
    let x = rows.filter((r) => !q || Object.values(r).join(' ').toLowerCase().includes(q.toLowerCase()))
    const s = sort && cols.find((c) => c.key === sort.k)?.sort
    if (s && sort) x = [...x].sort((a, b) => s(a, b) * sort.d)
    return x
  }, [rows, q, sort, cols])
  const pages = Math.max(1, Math.ceil(data.length / pageSize)), cur = Math.min(page, pages - 1), view = data.slice(cur * pageSize, cur * pageSize + pageSize)
  return <div className="rounded-xl border border-line bg-white">
    <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
      <div className="relative min-w-48 flex-1"><Search size={15} className="absolute left-3 top-2.5 text-muted" /><input aria-label="Search table" value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} placeholder="Search" className={cn(inputCls, 'pl-9')} /></div>
      {toolbar}
      <Button onClick={() => downloadFile(`${csvName}.csv`, toCsv(data as unknown as Record<string, unknown>[]), 'text/csv')} disabled={!data.length}><Download size={15} />Export CSV</Button>
    </div>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead className="bg-sand/60 text-xs text-muted"><tr>{cols.map((c) => <th key={c.key} scope="col" aria-sort={sort?.k === c.key ? (sort.d === 1 ? 'ascending' : 'descending') : undefined} className="px-4 py-2.5 font-medium">
        {c.sort ? <button className="inline-flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent" onClick={() => setSort(sort?.k === c.key ? { k: c.key, d: (sort.d * -1) as 1 | -1 } : { k: c.key, d: 1 })}>{c.header}{sort?.k === c.key && (sort.d === 1 ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}</button> : c.header}</th>)}</tr></thead>
      <tbody>{view.map((r) => <tr key={r.id} onClick={onRow && (() => onRow(r))} className={cn('border-t border-line', onRow && 'cursor-pointer hover:bg-paper')}>{cols.map((c) => <td key={c.key} className="px-4 py-3 align-middle">{c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? '')}</td>)}</tr>)}</tbody>
    </table></div>
    {!view.length && <EmptyState title={empty} hint="Clear the search or filters to see all records." />}
    <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-muted"><span>{data.length} result{data.length === 1 ? '' : 's'}</span>
      <div className="flex items-center gap-2"><Button variant="ghost" aria-label="Previous page" disabled={cur === 0} onClick={() => setPage(cur - 1)}><ChevronLeft size={15} /></Button>Page {cur + 1} of {pages}<Button variant="ghost" aria-label="Next page" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}><ChevronRight size={15} /></Button></div></div>
  </div>
}
export const Select = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) => <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, 'w-auto')}><option value="">{label}: all</option>{options.map((o) => <option key={o}>{o}</option>)}</select>
