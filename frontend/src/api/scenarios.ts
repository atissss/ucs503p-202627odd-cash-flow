import type { NewScenario, Scenario } from '../domain/scenario'

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  return (await res.json()) as T
}

export async function listScenarios(): Promise<Scenario[]> {
  return parse<Scenario[]>(await fetch('/api/scenarios'))
}

export async function createScenario(payload: NewScenario): Promise<Scenario> {
  const res = await fetch('/api/scenarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parse<Scenario>(res)
}

export async function deleteScenario(id: string): Promise<void> {
  const res = await fetch(`/api/scenarios/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Delete failed (${res.status})`)
}
