import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { anomalies } from '../api/services'
import type { Anomaly } from '../api/types'
import { Async, Badge, Button, DataTable, Dialog, PageHeader, Select, statusTone } from '../components/ui'
import { fmtDate } from '../lib/csv'
import { saved } from '../lib/notify'

export default function Exceptions() {
  const [f, setF] = useState({ severity: '', status: '', type: '' }), [sel, setSel] = useState<Anomaly | null>(null), qc = useQueryClient()
  const q = useQuery({ queryKey: ['anomalies'], queryFn: anomalies.list })
  const m = useMutation({ mutationFn: (v: { id: string; s: Anomaly['status'] }) => anomalies.update(v.id, v.s), onSuccess: (a) => { qc.invalidateQueries({ queryKey: ['anomalies'] }); saved(`${a.id} marked ${a.status.toLowerCase()}`); setSel(null) } })
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v })
  return <><PageHeader title="Exceptions" desc="Anomalies flagged in hiring data. Investigate, then resolve." />
    <Async q={q}>{(rows) => <><DataTable csvName="exceptions" onRow={setSel} rows={rows.filter((r) => (!f.severity || r.severity === f.severity) && (!f.status || r.status === f.status) && (!f.type || r.type === f.type))}
      toolbar={<><Select label="Severity" value={f.severity} onChange={set('severity')} options={['High', 'Medium', 'Low']} /><Select label="Status" value={f.status} onChange={set('status')} options={['Open', 'Investigating', 'Resolved']} /><Select label="Type" value={f.type} onChange={set('type')} options={[...new Set(rows.map((r) => r.type))]} /></>}
      cols={[{ key: 'type', header: 'Type', sort: (a, b) => a.type.localeCompare(b.type) }, { key: 'severity', header: 'Severity', sort: (a, b) => a.severity.localeCompare(b.severity), render: (r) => <Badge tone={statusTone(r.severity)}>{r.severity}</Badge> }, { key: 'subject', header: 'Subject' }, { key: 'detail', header: 'Detail' }, { key: 'detectedAt', header: 'Detected', sort: (a, b) => a.detectedAt.localeCompare(b.detectedAt), render: (r) => fmtDate(r.detectedAt) }, { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> }]} />
      <Dialog open={!!sel} onClose={() => setSel(null)} title={sel?.type ?? ''}>{sel && <div className="space-y-3 text-sm"><p>{sel.detail}</p><p className="text-muted">Subject {sel.subject} · detected {fmtDate(sel.detectedAt)} · <Badge tone={statusTone(sel.status)}>{sel.status}</Badge></p>
        <div className="flex justify-end gap-2"><Button onClick={() => setSel(null)}>Close</Button>{sel.status === 'Open' && <Button disabled={m.isPending} onClick={() => m.mutate({ id: sel.id, s: 'Investigating' })}>Start investigating</Button>}{sel.status !== 'Resolved' && <Button variant="primary" disabled={m.isPending} onClick={() => m.mutate({ id: sel.id, s: 'Resolved' })}>Mark resolved</Button>}</div></div>}</Dialog></>}</Async></>
}
