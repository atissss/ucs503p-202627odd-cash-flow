import type { CurrencyCode, ValuationOutput } from '../domain/scenario'

interface ResultsViewProps {
  valuation: ValuationOutput
  currency: CurrencyCode
}

/** Renders a `runDCF` result: the per-year projection table, then the enterprise -> equity -> per-share rollup. */
export function ResultsView({ valuation, currency }: ResultsViewProps) {
  if (valuation.status === 'invalid-assumptions') {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        Terminal growth must be less than WACC — adjust the assumptions to see
        a valuation.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto rounded-lg border border-ink-800">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink-800 text-xs tracking-wide text-ink-400 uppercase">
              <th className="px-3 py-2 font-medium">Year</th>
              <th className="px-3 py-2 font-medium">Free cash flow</th>
              <th className="px-3 py-2 font-medium">Discount factor</th>
              <th className="px-3 py-2 font-medium">Present value</th>
            </tr>
          </thead>
          <tbody>
            {valuation.projection.map((year) => (
              <tr key={year.year} className="border-b border-ink-800/60 last:border-0">
                <td className="px-3 py-2 text-ink-200 tabular-nums">{year.year}</td>
                <td className="px-3 py-2 text-ink-200 tabular-nums">
                  {formatMillions(year.freeCashFlow, currency)}
                </td>
                <td className="px-3 py-2 text-ink-400 tabular-nums">
                  {year.discountFactor.toFixed(4)}
                </td>
                <td className="px-3 py-2 text-ink-200 tabular-nums">
                  {formatMillions(year.presentValue, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        <Stat label="PV of projection" value={formatMillions(valuation.pvOfProjection, currency)} />
        <Stat label="Terminal value" value={formatMillions(valuation.terminalValue, currency)} />
        <Stat
          label="PV of terminal value"
          value={formatMillions(valuation.pvOfTerminalValue, currency)}
        />
        <Stat label="Enterprise value" value={formatMillions(valuation.enterpriseValue, currency)} />
        <Stat label="Equity value" value={formatMillions(valuation.equityValue, currency)} />
        <Stat
          label="Intrinsic value / share"
          value={formatPerShare(valuation.intrinsicValuePerShare, currency)}
          highlight
        />
      </dl>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd
        className={`mt-0.5 tabular-nums ${
          highlight ? 'text-lg font-semibold text-brand-400' : 'text-sm text-ink-200'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}

function formatMillions(value: number, currency: CurrencyCode): string {
  return `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}m`
}

function formatPerShare(value: number, currency: CurrencyCode): string {
  return `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}
