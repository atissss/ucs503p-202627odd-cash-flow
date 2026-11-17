import type { CurrencyCode, Scenario } from '../domain/scenario'
import { kindBadge, kindBar } from './scenarioStyles'

interface ComparisonViewProps {
  scenarios: Scenario[]
  currency: CurrencyCode
}

interface Row {
  label: string
  get: (s: Scenario) => string
  highlight?: boolean
}

/** Side-by-side diff of saved scenarios: a metric table, a per-share bar chart, and the valuation range. */
export function ComparisonView({ scenarios, currency }: ComparisonViewProps) {
  if (scenarios.length < 2) {
    return (
      <p className="text-sm text-ink-400">
        Save at least two scenarios — e.g. a Bull, Base and Bear case — to compare them side by
        side.
      </p>
    )
  }

  const perShare = scenarios.map((s) => s.valuation?.intrinsicValuePerShare ?? null)
  const valid = perShare.filter((v): v is number => v !== null)
  const maxAbs = Math.max(1, ...valid.map((v) => Math.abs(v)))
  const low = valid.length ? Math.min(...valid) : 0
  const high = valid.length ? Math.max(...valid) : 0

  const rows: Row[] = [
    { label: 'Growth rate', get: (s) => pct(s.assumptions.growthRate) },
    { label: 'WACC', get: (s) => pct(s.assumptions.wacc) },
    { label: 'Terminal growth', get: (s) => pct(s.assumptions.terminalGrowth) },
    { label: 'Enterprise value', get: (s) => money(s.valuation?.enterpriseValue, currency) },
    { label: 'Intrinsic value / share', get: (s) => perShareStr(s, currency), highlight: true },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto rounded-lg border border-ink-800">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink-800">
              <th className="px-3 py-2 text-xs font-medium tracking-wide text-ink-400 uppercase">
                Metric
              </th>
              {scenarios.map((s) => (
                <th key={s.id} className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs capitalize ${kindBadge[s.kind]}`}
                    >
                      {s.kind}
                    </span>
                    <span className="text-ink-200">{s.name}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-ink-800/60 last:border-0">
                <td className="px-3 py-2 text-ink-400">{row.label}</td>
                {scenarios.map((s) => (
                  <td
                    key={s.id}
                    className={`px-3 py-2 tabular-nums ${
                      row.highlight ? 'font-semibold text-brand-400' : 'text-ink-200'
                    }`}
                  >
                    {row.get(s)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium tracking-wide text-ink-400 uppercase">
          Intrinsic value / share
        </h3>
        {scenarios.map((s, i) => {
          const v = perShare[i]
          const width = v === null ? 0 : (Math.abs(v) / maxAbs) * 100
          return (
            <div key={s.id} className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-sm text-ink-300">{s.name}</span>
              <div className="h-5 grow rounded bg-ink-800/60">
                <div
                  className={`h-full rounded ${kindBar[s.kind]}`}
                  style={{ width: `${width}%` }}
                />
              </div>
              <span className="w-24 shrink-0 text-right text-sm text-ink-200 tabular-nums">
                {v === null ? '—' : `${currency} ${v.toFixed(2)}`}
              </span>
            </div>
          )
        })}
      </div>

      {valid.length >= 2 && (
        <p className="text-sm text-ink-400">
          Valuation range:{' '}
          <span className="text-ink-200 tabular-nums">
            {currency} {low.toFixed(2)}
          </span>
          {' – '}
          <span className="text-ink-200 tabular-nums">
            {currency} {high.toFixed(2)}
          </span>{' '}
          <span>
            (spread {currency} {(high - low).toFixed(2)})
          </span>
        </p>
      )}
    </div>
  )
}

function pct(decimal: number): string {
  return `${(decimal * 100).toFixed(1)}%`
}

function money(value: number | undefined, currency: CurrencyCode): string {
  if (value === undefined) return '—'
  return `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}m`
}

function perShareStr(s: Scenario, currency: CurrencyCode): string {
  const v = s.valuation?.intrinsicValuePerShare
  return v === undefined ? '—' : `${currency} ${v.toFixed(2)}`
}
