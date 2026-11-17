import { useState } from 'react'
import { createScenario, deleteScenario } from '../api/scenarios'
import type { Assumptions, Scenario, ScenarioKind, ValuationOutput } from '../domain/scenario'
import { KINDS, kindBadge } from './scenarioStyles'

interface ScenarioManagerProps {
  assumptions: Assumptions
  valuation: ValuationOutput
  scenarios: Scenario[]
  onChanged: () => void
  onLoad: (assumptions: Assumptions) => void
}

/** Save the current assumptions + valuation as a named case, and list/load/delete saved ones. */
export function ScenarioManager({
  assumptions,
  valuation,
  scenarios,
  onChanged,
  onLoad,
}: ScenarioManagerProps) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ScenarioKind>('base')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    try {
      await createScenario({
        name: trimmed,
        kind,
        dataStatus: 'manual',
        ticker: null,
        assumptions,
        valuation,
      })
      setName('')
      onChanged()
    } catch {
      setError('Could not save — is the backend running?')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setError(null)
    try {
      await deleteScenario(id)
      onChanged()
    } catch {
      setError('Could not delete.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block grow">
          <span className="text-xs text-ink-400">Scenario name</span>
          <input
            className="mt-1 w-full rounded-md border border-ink-700 bg-ink-950/60 px-2.5 py-1.5 text-sm text-ink-200 outline-none focus:border-brand-500"
            placeholder="e.g. AAPL — Base case"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save()
            }}
          />
        </label>
        <label className="block">
          <span className="text-xs text-ink-400">Case</span>
          <select
            className="mt-1 w-full rounded-md border border-ink-700 bg-ink-950/60 px-2.5 py-1.5 text-sm text-ink-200 capitalize outline-none focus:border-brand-500"
            value={kind}
            onChange={(e) => setKind(e.target.value as ScenarioKind)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !name.trim()}
          className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40"
        >
          Save scenario
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {scenarios.length === 0 ? (
        <p className="text-sm text-ink-400">
          No saved scenarios yet. Set your assumptions above, name the case, and save.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-ink-800 rounded-lg border border-ink-800">
          {scenarios.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-xs capitalize ${kindBadge[s.kind]}`}
              >
                {s.kind}
              </span>
              <span className="grow text-sm text-ink-200">{s.name}</span>
              <span className="text-sm text-ink-400 tabular-nums">
                {s.valuation
                  ? `${s.assumptions.currency} ${s.valuation.intrinsicValuePerShare.toFixed(2)}`
                  : '—'}
              </span>
              <button
                type="button"
                onClick={() => onLoad(s.assumptions)}
                className="text-xs text-brand-400 hover:underline"
              >
                Load
              </button>
              <button
                type="button"
                onClick={() => void remove(s.id)}
                className="text-xs text-ink-400 hover:text-red-400"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
