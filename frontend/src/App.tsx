import { useEffect, useState } from 'react'
import { DEFAULT_ASSUMPTIONS } from './domain/scenario'

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
  const a = DEFAULT_ASSUMPTIONS

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
              Scenario workspace
            </h2>
            <span className="rounded-full border border-brand-600/40 bg-brand-600/10 px-2.5 py-0.5 text-xs text-brand-400">
              Week 1 · scaffolding
            </span>
          </div>
          <p className="mt-3 text-sm text-ink-400">
            The valuation engine lands in Week 2. For now, this is the agreed
            input model it will consume:
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <Field label="Base free cash flow" value={`${a.baseFreeCashFlow} (${a.currency}m)`} />
            <Field label="Growth rate" value={pct(a.growthRate)} />
            <Field label="WACC" value={pct(a.wacc)} />
            <Field label="Terminal growth" value={pct(a.terminalGrowth)} />
            <Field label="Projection years" value={String(a.projectionYears)} />
            <Field label="Shares outstanding" value={String(a.sharesOutstanding)} />
          </dl>
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink-200 tabular-nums">{value}</dd>
    </div>
  )
}

function pct(decimal: number): string {
  return `${(decimal * 100).toFixed(1)}%`
}

export default App
