import type { Assumptions } from '../domain/scenario'

interface AssumptionsFormProps {
  assumptions: Assumptions
  onChange: (assumptions: Assumptions) => void
}

/** Editable grid of every `Assumptions` field. Calls back with a full, updated object on every change. */
export function AssumptionsForm({ assumptions, onChange }: AssumptionsFormProps) {
  function set<K extends keyof Assumptions>(key: K, value: Assumptions[K]) {
    onChange({ ...assumptions, [key]: value })
  }

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
      <NumberField
        label="Base free cash flow"
        suffix={`${assumptions.currency}m`}
        value={assumptions.baseFreeCashFlow}
        onChange={(v) => set('baseFreeCashFlow', v)}
      />
      <PercentField
        label="Growth rate"
        value={assumptions.growthRate}
        onChange={(v) => set('growthRate', v)}
      />
      <PercentField label="WACC" value={assumptions.wacc} onChange={(v) => set('wacc', v)} />
      <PercentField
        label="Terminal growth"
        value={assumptions.terminalGrowth}
        onChange={(v) => set('terminalGrowth', v)}
      />
      <NumberField
        label="Projection years"
        value={assumptions.projectionYears}
        min={1}
        max={30}
        step={1}
        onChange={(v) => set('projectionYears', Math.round(v))}
      />
      <NumberField
        label="Net debt"
        suffix={`${assumptions.currency}m`}
        value={assumptions.netDebt}
        onChange={(v) => set('netDebt', v)}
      />
      <NumberField
        label="Shares outstanding"
        suffix="m"
        value={assumptions.sharesOutstanding}
        min={0}
        onChange={(v) => set('sharesOutstanding', v)}
      />
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  suffix,
  min,
  max,
  step = 'any',
}: {
  label: string
  value: number
  onChange: (value: number) => void
  suffix?: string
  min?: number
  max?: number
  step?: number | 'any'
}) {
  return (
    <label className="block">
      <span className="text-xs text-ink-400">{label}</span>
      <div className="mt-1 flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-950/60 px-2.5 py-1.5 focus-within:border-brand-500">
        <input
          type="number"
          className="w-full bg-transparent text-sm text-ink-200 tabular-nums outline-none"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const next = e.target.valueAsNumber
            if (!Number.isNaN(next)) onChange(next)
          }}
        />
        {suffix && <span className="shrink-0 text-xs text-ink-400">{suffix}</span>}
      </div>
    </label>
  )
}

/** A rate field. Displayed and typed as a percentage (e.g. `9`), stored as a decimal (`0.09`). */
function PercentField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="text-xs text-ink-400">{label}</span>
      <div className="mt-1 flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-950/60 px-2.5 py-1.5 focus-within:border-brand-500">
        <input
          type="number"
          className="w-full bg-transparent text-sm text-ink-200 tabular-nums outline-none"
          value={roundTo(value * 100, 4)}
          step="0.1"
          onChange={(e) => {
            const next = e.target.valueAsNumber
            if (!Number.isNaN(next)) onChange(next / 100)
          }}
        />
        <span className="shrink-0 text-xs text-ink-400">%</span>
      </div>
    </label>
  )
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
