import { useMemo } from 'react'

import type { Assumptions, CurrencyCode } from '../domain/scenario'
import {
  HEAT_BUCKETS,
  buildSensitivity,
  defaultTerminalRange,
  defaultWaccRange,
  heatBucket,
  isCurrentCell,
  valueExtent,
} from '../domain/sensitivity'

interface SensitivityGridProps {
  assumptions: Assumptions
}

/**
 * Low → high colour scale. Full class names are listed literally so Tailwind
 * can see them at build time (it cannot detect interpolated class names).
 */
const HEAT_CLASSES: readonly string[] = [
  'bg-red-500/30 text-red-200',
  'bg-red-500/10 text-ink-200',
  'bg-ink-800 text-ink-200',
  'bg-brand-600/20 text-ink-200',
  'bg-brand-500/40 text-ink-200',
]

const INVALID_CLASSES = 'bg-ink-900 text-ink-700'
const CURRENT_CLASSES = 'ring-2 ring-brand-400 ring-inset font-semibold'

/** WACC × terminal-growth heatmap of intrinsic value per share for the current assumptions. */
export function SensitivityGrid({ assumptions }: SensitivityGridProps) {
  const { waccs, terminals, grid, extent } = useMemo(() => {
    const waccs = defaultWaccRange(assumptions)
    const terminals = defaultTerminalRange(assumptions)
    const grid = buildSensitivity(assumptions, waccs, terminals)
    return { waccs, terminals, grid, extent: valueExtent(grid) }
  }, [assumptions])

  if (waccs.length === 0 || terminals.length === 0) {
    return (
      <p className="text-sm text-ink-400">
        Enter a valid WACC and terminal growth to see the sensitivity grid.
      </p>
    )
  }

  const { currency } = assumptions

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-ink-800">
        <table className="w-full border-collapse text-center text-sm tabular-nums">
          <caption className="sr-only">
            Intrinsic value per share by WACC (columns) and terminal growth (rows)
          </caption>
          <thead>
            <tr className="border-b border-ink-800 text-xs text-ink-400">
              <th scope="col" className="px-3 py-2 text-left font-medium">
                g ↓ &nbsp;/&nbsp; WACC →
              </th>
              {waccs.map((wacc) => (
                <th key={wacc} scope="col" className="px-3 py-2 font-medium">
                  {pct(wacc)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, r) => (
              <tr key={terminals[r]} className="border-b border-ink-800/60 last:border-0">
                <th scope="row" className="px-3 py-2 text-left text-xs font-medium text-ink-400">
                  {pct(terminals[r])}
                </th>
                {row.map((cell) => {
                  const current = isCurrentCell(cell, assumptions)
                  const value = cell.valuePerShare
                  const invalid = value === null || extent === null
                  const colour = invalid
                    ? INVALID_CLASSES
                    : HEAT_CLASSES[heatBucket(value, extent.min, extent.max)]
                  const label = `WACC ${pct(cell.wacc)}, terminal growth ${pct(cell.terminalGrowth)}`
                  return (
                    <td
                      key={cell.wacc}
                      data-invalid={invalid || undefined}
                      aria-current={current || undefined}
                      title={invalid ? `${label}: invalid — terminal growth must be below WACC` : label}
                      className={`px-3 py-2 ${colour} ${current ? CURRENT_CLASSES : ''}`}
                    >
                      {invalid ? '—' : formatPerShare(value, currency)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-400">
        <span className="flex items-center gap-2">
          Low
          <span className="flex overflow-hidden rounded border border-ink-800">
            {HEAT_CLASSES.slice(0, HEAT_BUCKETS).map((cls) => (
              <span key={cls} className={`h-3 w-6 ${cls.split(' ')[0]}`} />
            ))}
          </span>
          High
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-6 rounded-sm bg-ink-900 border border-ink-800" />
          Invalid (terminal growth ≥ WACC)
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-6 rounded-sm ring-2 ring-brand-400 ring-inset" />
          Your current assumptions
        </span>
      </div>
    </div>
  )
}

function pct(decimal: number): string {
  return `${(decimal * 100).toFixed(1)}%`
}

/** Currency-formatted per-share value; falls back to a plain number on an unknown currency code. */
function formatPerShare(value: number, currency: CurrencyCode): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency}`
  }
}
