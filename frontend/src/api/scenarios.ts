import type { NewScenario, Scenario } from '../domain/scenario'
import { authHeaders, parseJson } from './http'

export async function listScenarios(): Promise<Scenario[]> {
  return parseJson<Scenario[]>(await fetch('/api/scenarios', { headers: authHeaders() }))
}

export async function createScenario(payload: NewScenario): Promise<Scenario> {
  const res = await fetch('/api/scenarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  })
  return parseJson<Scenario>(res)
}

export async function deleteScenario(id: string): Promise<void> {
  const res = await fetch(`/api/scenarios/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Delete failed (${res.status})`)
}
