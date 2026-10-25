/** The JWT access token, persisted in localStorage so a session survives reloads. */
const KEY = 'intrinsic.token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(KEY, token)
  } catch {
    /* private mode / storage disabled — session just won't persist */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
