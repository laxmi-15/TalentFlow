import { demoMode } from '../api/client'
import { toast } from '../components/ui'
export const saved = (msg: string) => toast(demoMode.get() ? `${msg} — demo only, not saved to a server.` : msg, demoMode.get() ? 'info' : 'success')
