import { useCallback, useEffect, useMemo, useState } from 'react'
import { listScenarios } from './api/scenarios'
import { AssumptionsForm } from './components/AssumptionsForm'
import { ComparisonView } from './components/ComparisonView'
import { ResultsView } from './components/ResultsView'
import { ScenarioManager } from './components/ScenarioManager'
import { runDCF } from './domain/runDCF'
import { DEFAULT_ASSUMPTIONS, type Assumptions, type Scenario } from './domain/scenario'

type BackendState = 'checking' | 'online' | 'offline'

/** Pings the FastAPI `/api/health` endpoint so the shell proves the full stack is wired. */
function useBackendHealth(): BackendState {
  const [state, setState] = useState<BackendState>('checking')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/health', { signal: controller.signal })
      .then((res) => setState(res.ok ? 'online' : 'offline'))
      .catch(() => setState('offline'))
    return () => controller.abort()
  }, [])

  return state
}

const HEALTH_LABEL: Record<BackendState, string> = {
  checking: 'Checking backend…',
  online: 'Backend online',
  offline: 'Backend offline',
}

const HEALTH_DOT: Record<BackendState, string> = {
  checking: 'bg-ink-400 animate-pulse',
  online: 'bg-brand-400',
  offline: 'bg-red-400',
}

function App() {
  const backend = useBackendHealth()
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS)
  const valuation = useMemo(() => runDCF(assumptions), [assumptions])

  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const refreshScenarios = useCallback(() => {
    listScenarios()
      .then(setScenarios)
      .catch(() => setScenarios([]))
  }, [])
  useEffect(() => {
    refreshScenarios()
  }, [refreshScenarios])

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-ink-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold tracking-tight text-ink-200">
              Intrinsic
            </span>
            <span className="text-sm text-ink-400">
              DCF Valuation &amp; Scenario Analysis
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-400">
            <span className={`h-2 w-2 rounded-full ${HEALTH_DOT[backend]}`} />
            {HEALTH_LABEL[backend]}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12">
        <section className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-ink-200 sm:text-4xl">
            Valuation as an auditable, repeatable workflow.
          </h1>
          <p className="mt-4 text-ink-400">
            Set your assumptions, compute an intrinsic value per share, and save
            named scenarios to compare Bull, Base and Bear side by side — not a
            spreadsheet, and not a black box.
          </p>
        </section>

        <section className="rounded-xl border border-ink-800 bg-ink-900/60 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium tracking-wide text-ink-400 uppercase">
              Assumptions
            </h2>
            <span className="rounded-full border border-brand-600/40 bg-brand-600/10 px-2.5 py-0.5 text-xs text-brand-400">
              Week 3 · valuation
            </span>
          </div>
          <p className="mt-3 text-sm text-ink-400">
            Every change recomputes the valuation below, live.
          </p>
          <div className="mt-5">
            <AssumptionsForm assumptions={assumptions} onChange={setAssumptions} />
          </div>
        </section>

        <section className="rounded-xl border border-ink-800 bg-ink-900/60 p-6">
          <h2 className="text-sm font-medium tracking-wide text-ink-400 uppercase">Valuation</h2>
          <div className="mt-5">
            <ResultsView valuation={valuation} currency={assumptions.currency} />
          </div>
        </section>

        <section className="rounded-xl border border-ink-800 bg-ink-900/60 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium tracking-wide text-ink-400 uppercase">Scenarios</h2>
            <span className="rounded-full border border-brand-600/40 bg-brand-600/10 px-2.5 py-0.5 text-xs text-brand-400">
              saved to backend
            </span>
          </div>
          <p className="mt-3 text-sm text-ink-400">
            Save this valuation as a named case (Bull / Base / Bear), then load or delete it later.
          </p>
          <div className="mt-5">
            <ScenarioManager
              assumptions={assumptions}
              valuation={valuation}
              scenarios={scenarios}
              onChanged={refreshScenarios}
              onLoad={setAssumptions}
            />
          </div>
        </section>

        <section className="rounded-xl border border-ink-800 bg-ink-900/60 p-6">
          <h2 className="text-sm font-medium tracking-wide text-ink-400 uppercase">Comparison</h2>
          <p className="mt-3 text-sm text-ink-400">
            Bull vs Base vs Bear — assumptions and intrinsic value per share, side by side.
          </p>
          <div className="mt-5">
            <ComparisonView scenarios={scenarios} currency={assumptions.currency} />
          </div>
        </section>
      </main>

      <footer className="border-t border-ink-800">
        <div className="mx-auto max-w-5xl px-6 py-4 text-xs text-ink-400">
          UCS503P · Thapar Institute · Bhavin, Bhoomi, Aatish
        </div>
      </footer>
    </div>
  )
}

export default App
