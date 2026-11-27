import { getToken } from '../auth/token'

/**
 * Base URL for the API. Empty in development, where Vite proxies `/api` to the
 * local backend. In production (e.g. the frontend on Vercel, backend hosted
 * elsewhere) set `VITE_API_BASE_URL` to the backend origin, e.g.
 * `https://intrinsic-api.onrender.com`.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

/** Prefix an `/api/...` path with the configured backend base URL. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}

/** Authorization header for the current session, or `{}` when logged out. */
export function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Parse a JSON response, surfacing the backend's error-envelope message on failure. */
export async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.error?.message && typeof body.error.message === 'string') {
        message = body.error.message
      }
    } catch {
      /* non-JSON error body — keep the status-code message */
    }
    throw new Error(message)
  }
  return (await res.json()) as T
}
