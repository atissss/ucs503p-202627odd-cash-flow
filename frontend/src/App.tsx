import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Building2,
  CircleDollarSign,
  Layers,
  LayoutGrid,
  LogOut,
  Menu,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthUser } from './api/auth'
import { listScenarios } from './api/scenarios'
import { useAuth } from './auth/useAuth'
import { AssumptionsForm } from './components/AssumptionsForm'
import { ComparisonView } from './components/ComparisonView'
import { FcfProjectionChart } from './components/FcfProjectionChart'
import { LoginView } from './components/LoginView'
import { ResultsView } from './components/ResultsView'
import { ScenarioManager } from './components/ScenarioManager'
import { SensitivityGrid } from './components/SensitivityGrid'
import { runDCF } from './domain/runDCF'
import { buildSensitivity } from './domain/sensitivity'
import {
  DEFAULT_ASSUMPTIONS,
  type Assumptions,
  type CurrencyCode,
  type Scenario,
  type ValuationOutput,
} from './domain/scenario'

/* ---------- backend health ---------- */

type BackendState = 'checking' | 'online' | 'offline'

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

/* ---------- views ---------- */

type View = 'valuation' | 'scenarios' | 'sensitivity'

const VIEWS: { id: View; label: string; icon: LucideIcon; blurb: string }[] = [
  {
    id: 'valuation',
    label: 'Valuation',
    icon: CircleDollarSign,
    blurb: 'Set your assumptions and read the intrinsic value per share, recomputed live.',
  },
  {
    id: 'scenarios',
    label: 'Scenarios',
    icon: Layers,
    blurb: 'Save Bull / Base / Bear cases and compare them side by side.',
  },
  {
    id: 'sensitivity',
    label: 'Sensitivity',
    icon: LayoutGrid,
    blurb: 'See how the valuation moves across growth and discount-rate ranges.',
  },
]

/* ---------- formatting ---------- */

const money = (v: number, c: CurrencyCode) =>
  `${c} ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}m`
const perShare = (v: number, c: CurrencyCode) =>
  `${c} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/* ---------- app ---------- */

function App() {
  const backend = useBackendHealth()
  const { user, ready, login, register, logout } = useAuth()

  if (!ready) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-ink-400">Loading…</div>
    )
  }
  if (!user) {
    return <LoginView onLogin={login} onRegister={register} />
  }
  return <Workspace user={user} backend={backend} onLogout={logout} />
}

function Workspace({
  user,
  backend,
  onLogout,
}: {
  user: AuthUser
  backend: BackendState
  onLogout: () => void
}) {
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

  const [view, setView] = useState<View>('valuation')
  const [menuOpen, setMenuOpen] = useState(false)
  const current = VIEWS.find((v) => v.id === view)!
  const currency = assumptions.currency

  return (
    <div className="gd-app">
      <div className="gd-surround">
        <header className="gd-top">
          <div className="gd-brand">
            <span className="gd-logo" aria-hidden="true">
              ◆
            </span>
          </div>
          <div className="gd-top-center">
            <strong>Intrinsic</strong>
            <small>DCF Valuation &amp; Scenario Analysis</small>
          </div>
          <div className="gd-top-actions">
            <button
              type="button"
              className="gd-icon-button"
              aria-label="Menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Menu aria-hidden="true" />
            </button>
            {menuOpen && (
              <>
                <button
                  type="button"
                  aria-hidden="true"
                  tabIndex={-1}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 10,
                    background: 'transparent',
                    border: 0,
                    cursor: 'default',
                  }}
                />
                <div className="gd-menu">
                  <div className="gd-menu-row">
                    <i data-state={backend} aria-hidden="true" />
                    {HEALTH_LABEL[backend]}
                  </div>
                  <div className="gd-menu-row" style={{ color: 'var(--gd-ink)' }}>
                    {user.email}
                  </div>
                  <button type="button" onClick={onLogout}>
                    <LogOut aria-hidden="true" />
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <div className="gd-stage-wrap">
          <Dock view={view} onSelect={setView} side />
          <main className="gd-stage">
            <div className="gd-stage-scroll">
              <header className="gd-view-head">
                <div>
                  <h1>{current.label}</h1>
                  <p>{current.blurb}</p>
                </div>
              </header>
              <div className="gd-content" key={view}>
                {view === 'valuation' && (
                  <ValuationView
                    assumptions={assumptions}
                    setAssumptions={setAssumptions}
                    valuation={valuation}
                    currency={currency}
                  />
                )}
                {view === 'scenarios' && (
                  <ScenariosView
                    assumptions={assumptions}
                    valuation={valuation}
                    scenarios={scenarios}
                    refresh={refreshScenarios}
                    onLoad={setAssumptions}
                    currency={currency}
                  />
                )}
                {view === 'sensitivity' && (
                  <SensitivityView assumptions={assumptions} valuation={valuation} currency={currency} />
                )}
              </div>
            </div>
          </main>
          <Dock view={view} onSelect={setView} />
        </div>

        <footer className="gd-footer">
          <span>Intrinsic · UCS503P · Thapar Institute</span>
          <span>Signed in as {user.email}</span>
        </footer>
      </div>
    </div>
  )
}

/* ---------- shell pieces ---------- */

function Dock({
  view,
  onSelect,
  side = false,
}: {
  view: View
  onSelect: (v: View) => void
  side?: boolean
}) {
  return (
    <nav className={side ? 'gd-dock gd-dock-side' : 'gd-dock gd-dock-bottom'} aria-label="Views">
      {VIEWS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-label={label}
          aria-current={view === id ? 'page' : undefined}
          onClick={() => onSelect(id)}
        >
          <Icon aria-hidden="true" />
          {side ? (
            <span className="gd-dock-tip" aria-hidden="true">
              {label}
            </span>
          ) : (
            <span>{label}</span>
          )}
        </button>
      ))}
    </nav>
  )
}

function Metric({
  title,
  icon,
  value,
  caption,
  tone,
}: {
  title: string
  icon: ReactNode
  value: string
  caption?: string
  tone?: 'teal'
}) {
  return (
    <article className="gd-metric" data-tone={tone}>
      <div className="gd-metric-head">
        <span>{title}</span>
        <span className="gd-metric-icon" aria-hidden="true">
          {icon}
        </span>
      </div>
      <strong className="gd-metric-value">{value}</strong>
      {caption && <div className="gd-metric-caption">{caption}</div>}
    </article>
  )
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <section className="gd-panel">
      <header className="gd-panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  )
}

/* ---------- views ---------- */

function ValuationView({
  assumptions,
  setAssumptions,
  valuation,
  currency,
}: {
  assumptions: Assumptions
  setAssumptions: (a: Assumptions) => void
  valuation: ValuationOutput
  currency: CurrencyCode
}) {
  const ok = valuation.status === 'ok'
  return (
    <>
      <div className="gd-metric-grid">
        <Metric
          tone="teal"
          title="Intrinsic value / share"
          icon={<CircleDollarSign />}
          value={ok ? perShare(valuation.intrinsicValuePerShare, currency) : '—'}
          caption={ok ? 'computed from the assumptions below' : 'terminal growth must be below WACC'}
        />
        <Metric
          title="Enterprise value"
          icon={<Building2 />}
          value={ok ? money(valuation.enterpriseValue, currency) : '—'}
          caption="PV of projection + terminal"
        />
        <Metric
          title="Equity value"
          icon={<Wallet />}
          value={ok ? money(valuation.equityValue, currency) : '—'}
          caption="enterprise value less net debt"
        />
        <Metric
          title="Terminal value"
          icon={<TrendingUp />}
          value={ok ? money(valuation.terminalValue, currency) : '—'}
          caption="Gordon-growth perpetuity"
        />
      </div>
      <div className="gd-two">
        <Panel title="Assumptions" subtitle="Every change recomputes the valuation live.">
          <AssumptionsForm assumptions={assumptions} onChange={setAssumptions} />
        </Panel>
        <Panel title="Cash-flow projection" subtitle="Projected free cash flow by year.">
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <FcfProjectionChart valuation={valuation} assumptions={assumptions} currency={currency} />
          </div>
        </Panel>
      </div>
      <Panel title="Breakdown" subtitle="Per-year discounting and the enterprise → equity rollup.">
        <ResultsView valuation={valuation} currency={currency} />
      </Panel>
    </>
  )
}

function ScenariosView({
  assumptions,
  valuation,
  scenarios,
  refresh,
  onLoad,
  currency,
}: {
  assumptions: Assumptions
  valuation: ValuationOutput
  scenarios: Scenario[]
  refresh: () => void
  onLoad: (a: Assumptions) => void
  currency: CurrencyCode
}) {
  const values = scenarios
    .map((s) => (s.valuation && s.valuation.status === 'ok' ? s.valuation.intrinsicValuePerShare : null))
    .filter((v): v is number => v !== null)
  const low = values.length ? Math.min(...values) : null
  const high = values.length ? Math.max(...values) : null
  return (
    <>
      <div className="gd-metric-grid">
        <Metric title="Saved cases" icon={<Layers />} value={String(scenarios.length)} caption="in your workspace" />
        <Metric
          title="Lowest value"
          icon={<ArrowDownRight />}
          value={low === null ? '—' : perShare(low, currency)}
          caption="intrinsic value / share"
        />
        <Metric
          title="Highest value"
          icon={<ArrowUpRight />}
          value={high === null ? '—' : perShare(high, currency)}
          caption="intrinsic value / share"
        />
        <Metric
          title="Spread"
          icon={<ArrowLeftRight />}
          value={low === null || high === null ? '—' : perShare(high - low, currency)}
          caption="highest − lowest"
        />
      </div>
      <Panel
        title="Save a scenario"
        subtitle="Name the current case (Bull / Base / Bear), then load or delete it later."
      >
        <ScenarioManager
          assumptions={assumptions}
          valuation={valuation}
          scenarios={scenarios}
          onChanged={refresh}
          onLoad={onLoad}
        />
      </Panel>
      <Panel
        title="Comparison"
        subtitle="Bull vs Base vs Bear — assumptions and intrinsic value per share, side by side."
      >
        <ComparisonView scenarios={scenarios} currency={currency} />
      </Panel>
    </>
  )
}

function SensitivityView({
  assumptions,
  valuation,
  currency,
}: {
  assumptions: Assumptions
  valuation: ValuationOutput
  currency: CurrencyCode
}) {
  const { lo, hi } = buildSensitivity(assumptions)
  const ok = valuation.status === 'ok'
  return (
    <>
      <div className="gd-metric-grid">
        <Metric
          tone="teal"
          title="Current value"
          icon={<CircleDollarSign />}
          value={ok ? perShare(valuation.intrinsicValuePerShare, currency) : '—'}
          caption="at your assumptions"
        />
        <Metric
          title="Best case"
          icon={<ArrowUpRight />}
          value={perShare(hi, currency)}
          caption="highest in the grid"
        />
        <Metric
          title="Worst case"
          icon={<ArrowDownRight />}
          value={perShare(lo, currency)}
          caption="lowest in the grid"
        />
        <Metric
          title="Range"
          icon={<ArrowLeftRight />}
          value={perShare(hi - lo, currency)}
          caption="best − worst"
        />
      </div>
      <Panel
        title="Sensitivity"
        subtitle="Intrinsic value per share across a growth × WACC grid, centred on your inputs."
      >
        <SensitivityGrid assumptions={assumptions} currency={currency} />
      </Panel>
    </>
  )
}

export default App
