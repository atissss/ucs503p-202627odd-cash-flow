import type { NewScenario, Scenario } from '../domain/scenario'
import { toCamelCase, toSnakeCase } from './casing'
import { apiUrl, authHeaders, parseJson } from './http'

export async function listScenarios(): Promise<Scenario[]> {
  const raw = await parseJson<unknown>(await fetch(apiUrl('/api/scenarios'), { headers: authHeaders() }))
  return toCamelCase<Scenario[]>(raw)
}

export async function createScenario(payload: NewScenario): Promise<Scenario> {
  const res = await fetch(apiUrl('/api/scenarios'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(toSnakeCase(payload)),
  })
  return toCamelCase<Scenario>(await parseJson<unknown>(res))
}

export async function deleteScenario(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/scenarios/${id}`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Delete failed (${res.status})`)
}
