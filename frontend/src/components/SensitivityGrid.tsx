import type { CSSProperties } from 'react'
import type { Assumptions, CurrencyCode } from '../domain/scenario'
import { buildSensitivity } from '../domain/sensitivity'

interface SensitivityGridProps {
  assumptions: Assumptions
  currency: CurrencyCode
}

const pct = (d: number) => `${(d * 100).toFixed(1)}%`
const fmt = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Heat-mapped 5×5 grid of intrinsic value per share across growth × WACC. */
export function SensitivityGrid({ assumptions, currency }: SensitivityGridProps) {
  const { growths, waccs, cells, lo, hi } = buildSensitivity(assumptions)

  const heat = (value: number | null): CSSProperties => {
    if (value === null) return { background: 'var(--gd-inner)', color: 'var(--gd-muted)' }
    const f = hi === lo ? 0.5 : (value - lo) / (hi - lo)
    const hue = Math.round(8 + f * 142)
    const light = Math.round(72 - f * 8)
    return { background: `hsl(${hue} 52% ${light}%)`, color: '#2a221e' }
  }

  return (
    <div className="gd-sens">
      <table>
        <thead>
          <tr>
            <th className="gd-axis" rowSpan={2} style={{ verticalAlign: 'bottom', textAlign: 'left' }}>
              Growth ↓ / WACC →
            </th>
            <th className="gd-axis" colSpan={waccs.length}>
              WACC
            </th>
          </tr>
          <tr>
            {waccs.map((w) => (
              <th key={w} className="gd-axis">
                {pct(w)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {growths.map((g, i) => (
            <tr key={g}>
              <td className="gd-rowhead">{pct(g)}</td>
              {waccs.map((w, j) => {
                const value = cells[i][j]
                const here =
                  Math.abs(g - assumptions.growthRate) < 1e-9 && Math.abs(w - assumptions.wacc) < 1e-9
                return (
                  <td key={w} className={`gd-cell ${here ? 'gd-here' : ''}`} style={heat(value)}>
                    {value === null ? '—' : fmt(value)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="gd-sens-legend">
        <span>lower</span>
        <span className="gd-sens-scale" />
        <span>higher</span>
        <span style={{ marginLeft: 8 }}>
          intrinsic value / share ({currency}) · rows = growth · columns = WACC · outlined = current
        </span>
      </div>
    </div>
  )
}
