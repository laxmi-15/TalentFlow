import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LayoutDashboard, Briefcase, Users, Kanban, CalendarDays, UsersRound, ClipboardCheck, BadgeDollarSign, AlertTriangle, Database, History, Settings, Search, Bell, ChevronDown, Menu, PanelLeftClose, PanelLeft, FlaskConical } from 'lucide-react'
import { demoMode, getToken } from '../api/client'
import { anomalies, approvals, auth, candidates } from '../api/services'
import { ToastHost, cn, inputCls, toast, Button, Dialog, Field } from './ui'

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard }, { to: '/requisitions', label: 'Requisitions', icon: Briefcase }, { to: '/candidates', label: 'Candidates', icon: Users },
  { to: '/pipeline', label: 'Pipeline', icon: Kanban }, { to: '/interviews', label: 'Interviews', icon: CalendarDays }, { to: '/panels', label: 'Panels', icon: UsersRound },
  { to: '/scorecards', label: 'Scorecards', icon: ClipboardCheck }, { to: '/offers', label: 'Offers', icon: BadgeDollarSign }, { to: '/exceptions', label: 'Exceptions', icon: AlertTriangle },
  { to: '/data-quality', label: 'Data quality', icon: Database }, { to: '/audit', label: 'Audit history', icon: History }, { to: '/admin', label: 'Admin', icon: Settings },
]

function Popover({ label, button, children, align = 'right' }: { label: string; button: ReactNode; children: ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false), ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const out = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', out); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc) }
  }, [open])
  return <div ref={ref} className="relative"><button aria-label={label} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)} className="flex items-center gap-1 rounded-lg p-2 hover:bg-sand focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">{button}</button>
    {open && <div className={cn('absolute top-full z-40 mt-2 w-80 max-w-[90vw] rounded-xl border border-line bg-white p-2 shadow-xl', align === 'right' ? 'right-0' : 'left-0')} onClick={() => setOpen(false)}>{children}</div>}</div>
}

function GlobalSearch() {
  const [q, setQ] = useState(''), nav = useNavigate()
  const cs = useQuery({ queryKey: ['candidates'], queryFn: candidates.list })
  const ql = q.trim().toLowerCase()
  const res = ql.length < 2 ? [] : [...NAV.filter((n) => n.label.toLowerCase().includes(ql)).map((n) => ({ label: n.label, hint: 'Page', to: n.to })), ...(cs.data ?? []).filter((c) => `${c.name} ${c.role}`.toLowerCase().includes(ql)).slice(0, 5).map((c) => ({ label: c.name, hint: c.role, to: `/candidates/${c.id}` }))].slice(0, 7)
  const go = (to: string) => { setQ(''); nav(to) }
  return <div className="relative w-full max-w-md"><Search size={15} className="absolute left-3 top-2.5 text-muted" />
    <input role="combobox" aria-expanded={res.length > 0} aria-controls="gs" aria-label="Search candidates and pages" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && res[0]) go(res[0].to); if (e.key === 'Escape') setQ('') }} placeholder="Search candidates and pages" className={cn(inputCls, 'pl-9')} />
    {ql.length >= 2 && <ul id="gs" role="listbox" className="absolute z-40 mt-2 w-full rounded-xl border border-line bg-white p-1 shadow-xl">{res.length ? res.map((x) => <li key={x.to} role="option" aria-selected="false"><button onClick={() => go(x.to)} className="flex w-full justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-sand focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><span>{x.label}</span><span className="text-xs text-muted">{x.hint}</span></button></li>) : <li className="px-3 py-2 text-sm text-muted">No matches for “{q}”</li>}</ul>}</div>
}

function Notifications() {
  const ap = useQuery({ queryKey: ['approvals'], queryFn: approvals.list }), an = useQuery({ queryKey: ['anomalies'], queryFn: anomalies.list })
  const pend = (ap.data ?? []).filter((a) => a.status === 'Pending'), hi = (an.data ?? []).filter((a) => a.severity === 'High' && a.status !== 'Resolved')
  const n = pend.length + hi.length
  return <Popover label={`Notifications, ${n} unread`} button={<span className="relative"><Bell size={18} />{n > 0 && <span className="absolute -right-1.5 -top-1.5 rounded-full bg-accent px-1 text-[10px] text-white">{n}</span>}</span>}>
    <p className="px-3 py-2 text-sm font-medium">Notifications</p>
    {n === 0 && <p className="px-3 py-4 text-sm text-muted">You are all caught up.</p>}
    {pend.slice(0, 4).map((a) => <Link key={a.id} to={a.type === 'Offer' ? '/offers' : '/requisitions'} className="block rounded-lg px-3 py-2 text-sm hover:bg-sand"><span className="font-medium">{a.type} approval waiting</span><br /><span className="text-muted">{a.subject}</span></Link>)}
    {hi.slice(0, 3).map((a) => <Link key={a.id} to="/exceptions" className="block rounded-lg px-3 py-2 text-sm hover:bg-sand"><span className="font-medium">High severity: {a.type}</span><br /><span className="text-muted">{a.detail}</span></Link>)}
  </Popover>
}

const PERSONAS = [
  { name: 'Meera Joshi', role: 'Admin', email: 'meera@example.test' },
  { name: 'Chris Alder', role: 'Recruiter', email: 'chris@example.test' },
  { name: 'Dana Whitfield', role: 'Hiring Manager', email: 'dana@example.test' },
  { name: 'Samir Qureshi', role: 'Interviewer', email: 'samir@example.test' },
  { name: 'Lena Fischer', role: 'Approver', email: 'lena@example.test' },
]

function Profile() {
  const qc = useQueryClient()
  const me = useQuery({ queryKey: ['me'], queryFn: auth.me })
  const [loginOpen, setLoginOpen] = useState(false)
  const [email, setEmail] = useState('meera@example.test')
  const [password, setPassword] = useState('TalentFlow2026!')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setLoading(true)
    try {
      const res = await auth.login(email, password)
      qc.invalidateQueries()
      setLoginOpen(false)
      toast(`Signed in as ${res.user.name} (${res.user.role}).`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Invalid credentials', 'error')
    } finally {
      setLoading(false)
    }
  }

  const switchPersona = async (p: typeof PERSONAS[0]) => {
    try {
      const res = await auth.login(p.email, 'TalentFlow2026!')
      qc.invalidateQueries()
      toast(`Switched to ${res.user.name} (${res.user.role}).`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to switch user', 'error')
    }
  }

  const out = async () => {
    await auth.signOut()
    qc.invalidateQueries()
    toast('Signed out.', 'info')
  }

  const token = getToken()

  if (!token && !me.data) {
    return (
      <>
        <Button variant="primary" onClick={() => setLoginOpen(true)} className="text-xs py-1.5 px-3">
          Sign in
        </Button>
        <Dialog open={loginOpen} onClose={() => setLoginOpen(false)} title="Sign in to TalentFlow">
          <form onSubmit={handleLogin} className="space-y-4">
            <Field label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
            </Field>
            <Field label="Password">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputCls} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setLoginOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button>
            </div>
            <div className="border-t border-line pt-3">
              <p className="text-xs text-muted mb-2 font-medium">Or quick sign in as a demo user:</p>
              <div className="flex flex-wrap gap-1.5">
                {PERSONAS.map((p) => (
                  <button
                    key={p.email}
                    type="button"
                    onClick={() => { setEmail(p.email); switchPersona(p); setLoginOpen(false) }}
                    className="rounded-lg bg-sand px-2.5 py-1 text-xs text-navy hover:bg-line"
                  >
                    {p.name} ({p.role})
                  </button>
                ))}
              </div>
            </div>
          </form>
        </Dialog>
      </>
    )
  }

  return (
    <>
      <Popover label="Open profile menu" button={<><span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-xs font-semibold text-white">{me.data?.name.split(' ').map((p) => p[0]).join('') ?? '··'}</span><ChevronDown size={14} /></>}>
        <div className="px-3 py-2 border-b border-line">
          <p className="text-sm font-medium">{me.data?.name ?? 'Loading…'}</p>
          <p className="text-xs text-muted">{me.data?.email} · {me.data?.role}</p>
        </div>
        <div className="px-3 py-2 border-b border-line">
          <p className="text-xs font-medium text-muted mb-1.5">Switch role:</p>
          <div className="flex flex-col gap-1">
            {PERSONAS.map((p) => (
              <button
                key={p.email}
                onClick={() => switchPersona(p)}
                className={cn('rounded px-2 py-1 text-left text-xs transition-colors hover:bg-sand', me.data?.email === p.email ? 'font-semibold text-accent' : 'text-navy')}
              >
                {p.name} <span className="text-muted">({p.role})</span>
              </button>
            ))}
          </div>
        </div>
        <Link to="/admin" className="block rounded-lg px-3 py-2 text-sm hover:bg-sand">Settings</Link>
        <button onClick={out} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">Sign out</button>
      </Popover>
      <Dialog open={loginOpen} onClose={() => setLoginOpen(false)} title="Sign in to TalentFlow">
        <form onSubmit={handleLogin} className="space-y-4">
          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
          </Field>
          <Field label="Password">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputCls} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setLoginOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false), [mobile, setMobile] = useState(false), loc = useLocation()
  const demo = useSyncExternalStore(demoMode.subscribe, demoMode.get)
  useEffect(() => setMobile(false), [loc.pathname])
  const crumbs = loc.pathname.split('/').filter(Boolean)
  const label = (s: string) => NAV.find((n) => n.to === `/${s}`)?.label ?? s.toUpperCase()
  return <div className="flex min-h-screen">
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">Skip to content</a>
    {mobile && <div className="fixed inset-0 z-30 bg-navy/40 lg:hidden" onClick={() => setMobile(false)} />}
    <aside aria-label="Primary" className={cn('fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-white transition-[width,transform] lg:sticky lg:top-0 lg:h-screen lg:translate-x-0', collapsed ? 'lg:w-[68px]' : 'lg:w-60', 'w-60', mobile ? 'translate-x-0' : '-translate-x-full')}>
      <div className="flex h-14 items-center gap-2 border-b border-line px-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-sm font-bold text-white">T</span>{!collapsed && <span className="font-semibold tracking-tight">TalentFlow</span>}</div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">{NAV.map(({ to, label: l, icon: I }) => <NavLink key={to} to={to} end={to === '/'} title={l} className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent', isActive ? 'bg-accent-soft font-medium text-accent' : 'text-navy hover:bg-sand')}><I size={18} className="shrink-0" />{!collapsed && l}{collapsed && <span className="sr-only">{l}</span>}</NavLink>)}</nav>
      <button onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="hidden items-center gap-3 border-t border-line p-4 text-sm text-muted hover:text-navy lg:flex">{collapsed ? <PanelLeft size={18} /> : <><PanelLeftClose size={18} />Collapse</>}</button>
    </aside>
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-paper/90 px-4 backdrop-blur"><button className="rounded-lg p-2 hover:bg-sand lg:hidden" aria-label="Open navigation" onClick={() => setMobile(true)}><Menu size={18} /></button><GlobalSearch /><div className="ml-auto flex items-center gap-1"><Notifications /><Profile /></div></header>
      {demo && <div role="status" className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"><FlaskConical size={16} className="mt-0.5 shrink-0" /><span><strong>Demo mode.</strong> The API is not connected, so you are seeing synthetic data. Changes stay in this browser tab only and are never sent to a server.</span></div>}
      <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-3 text-sm text-muted"><ol className="flex gap-1.5"><li><Link to="/" className="hover:text-navy">Home</Link></li>{crumbs.map((c, i) => <li key={i} className="flex gap-1.5"><span aria-hidden>/</span><span aria-current={i === crumbs.length - 1 ? 'page' : undefined}>{label(c)}</span></li>)}</ol></nav>
        <Outlet />
      </main>
    </div>
    <ToastHost />
  </div>
}
