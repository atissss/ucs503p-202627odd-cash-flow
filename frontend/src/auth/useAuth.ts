import { useCallback, useEffect, useState } from 'react'
import { getMe, login as apiLogin, register as apiRegister, type AuthUser } from '../api/auth'
import { clearToken, getToken, setToken } from './token'

export interface Auth {
  user: AuthUser | null
  /** False until the stored token (if any) has been validated on load. */
  ready: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
}

/** Session state: validates a stored token on load, then exposes login/register/logout. */
export function useAuth(): Auth {
  const [user, setUser] = useState<AuthUser | null>(null)
  // Ready immediately when there's no stored token; otherwise after it's validated.
  const [ready, setReady] = useState(() => !getToken())

  useEffect(() => {
    if (!getToken()) return
    getMe()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setReady(true))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setToken(await apiLogin(email, password))
    setUser(await getMe())
  }, [])

  const register = useCallback(
    async (email: string, password: string) => {
      await apiRegister(email, password)
      await login(email, password)
    },
    [login],
  )

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  return { user, ready, login, register, logout }
}
