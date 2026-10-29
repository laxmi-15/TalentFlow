import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query'
import App from './App'
import { toast } from './components/ui'
import './index.css'

const qc = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false } },
  mutationCache: new MutationCache({ onError: (e) => toast(e instanceof Error ? e.message : 'Something went wrong.', 'error') }),
})
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={qc}><BrowserRouter><App /></BrowserRouter></QueryClientProvider></StrictMode>)
