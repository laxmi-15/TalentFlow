import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { audit } from '../api/services'
import { Async, DataTable, PageHeader, Select, inputCls } from '../components/ui'

export default function Audit() {
  const [entity, setEntity] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState(''), q = useQuery({ queryKey: ['audit'], queryFn: audit.list })
  return <><PageHeader title="Audit history" desc="Who did what, and when. Export the filtered view for compliance reviews." />
    <Async q={q}>{(rows) => <DataTable csvName="audit-events" pageSize={10} rows={rows.filter((r) => (!entity || r.entity === entity) && (!from || r.at >= from) && (!to || r.at <= `${to}T23:59:59.999Z`))}
      toolbar={<><Select label="Entity" value={entity} onChange={setEntity} options={[...new Set(rows.map((r) => r.entity))]} /><label className="text-xs text-muted">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls + ' w-auto'} /></label><label className="text-xs text-muted">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls + ' w-auto'} /></label></>}
      cols={[{ key: 'at', header: 'Time', sort: (a, b) => a.at.localeCompare(b.at), render: (r) => new Date(r.at).toLocaleString('en-GB') }, { key: 'actor', header: 'Actor', sort: (a, b) => a.actor.localeCompare(b.actor) }, { key: 'action', header: 'Action' }, { key: 'entity', header: 'Entity' }, { key: 'entityId', header: 'Record' }]} />}</Async></>
}
