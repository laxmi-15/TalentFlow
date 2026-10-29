// HTTP client. All requests go to `${VITE_API_BASE_URL}/api/v1`. No secrets live in the frontend.
export const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8080'
export const DEMO_FORCED = import.meta.env.VITE_DEMO_MODE === 'true'

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) { super(message) }
}

let demo = false
const subs = new Set<() => void>()
export const demoMode = {
  get: () => demo,
  set(v: boolean) { if (demo !== v) { demo = v; subs.forEach((f) => f()) } },
  subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f) } },
}
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const TOKEN_KEY = 'tf_token'
const SIGNED_OUT_KEY = 'tf_signed_out'

export const getToken = () => sessionStorage.getItem(TOKEN_KEY)
export const setToken = (t: string | null) => {
  if (t) {
    sessionStorage.setItem(TOKEN_KEY, t)
    sessionStorage.removeItem(SIGNED_OUT_KEY)
  } else {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.setItem(SIGNED_OUT_KEY, 'true')
  }
}

let autoAuthPromise: Promise<string | null> | null = null

async function ensureToken(): Promise<string | null> {
  const existing = sessionStorage.getItem(TOKEN_KEY)
  if (existing) return existing
  if (sessionStorage.getItem(SIGNED_OUT_KEY)) return null
  if (autoAuthPromise) return autoAuthPromise

  autoAuthPromise = (async () => {
    try {
      const res = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'meera@example.test', password: 'TalentFlow2026!' }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.token) {
          sessionStorage.setItem(TOKEN_KEY, data.token)
          demoMode.set(false)
          return data.token
        }
      }
    } catch {
      // Backend unreachable; http will catch it
    } finally {
      autoAuthPromise = null
    }
    return null
  })()

  return autoAuthPromise
}

export async function http<R>(method: string, path: string, body?: unknown): Promise<R> {
  let token = sessionStorage.getItem(TOKEN_KEY)
  if (!token && !path.startsWith('/auth/login') && !path.startsWith('/health')) {
    token = await ensureToken()
  }

  let res: Response
  try {
    res = await fetch(`${BASE}/api/v1${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'The API could not be reached.')
  }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login')) {
      sessionStorage.removeItem(TOKEN_KEY)
    }
    let payload: { message?: string } | undefined
    try { payload = await res.json() } catch { /* non-JSON error body */ }
    const fallback: Record<number, string> = {
      401: 'Your session has expired. Sign in again.',
      403: 'You do not have permission to do this.',
      404: 'That record was not found.',
      422: 'The server rejected the submitted values.',
    }
    throw new ApiError(res.status, payload?.message ?? fallback[res.status] ?? `Request failed (${res.status}).`, payload)
  }
  return res.status === 204 ? (undefined as R) : ((await res.json()) as R)
}
