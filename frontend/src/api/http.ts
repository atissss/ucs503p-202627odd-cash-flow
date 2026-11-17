import { getToken } from '../auth/token'

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
