import { authHeaders, parseJson } from './http'

export interface AuthUser {
  id: string
  email: string
}

interface TokenResponse {
  access_token: string
  token_type: string
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export async function register(email: string, password: string): Promise<AuthUser> {
  return parseJson<AuthUser>(
    await fetch('/api/auth/register', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ email, password }),
    }),
  )
}

export async function login(email: string, password: string): Promise<string> {
  const { access_token } = await parseJson<TokenResponse>(
    await fetch('/api/auth/login', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ email, password }),
    }),
  )
  return access_token
}

export async function getMe(): Promise<AuthUser> {
  return parseJson<AuthUser>(await fetch('/api/auth/me', { headers: authHeaders() }))
}
