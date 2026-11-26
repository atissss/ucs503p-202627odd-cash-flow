import { useEffect, useState } from 'react'
import type { Assumptions, CurrencyCode, ValuationOutput } from '../domain/scenario'
import { PeakChart } from './ui/peak-chart'

interface FcfProjectionChartProps {
  valuation: ValuationOutput
  assumptions: Assumptions
  currency: CurrencyCode
}

/** A window-based width so the card fits small screens without measuring its own container. */
function useResponsiveWidth(min = 260, max = 360): number {
  const get = () =>
    typeof window === 'undefined' ? max : Math.max(min, Math.min(max, window.innerWidth - 120))
  const [width, setWidth] = useState(get)
  useEffect(() => {
    const onResize = () => setWidth(get())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return width
}

/**
 * Visualises the DCF as a line: the projected free cash flow for each year, with the headline
 * intrinsic value per share. Shows a note instead when the assumptions don't compute.
 */
export function FcfProjectionChart({ valuation, assumptions, currency }: FcfProjectionChartProps) {
  const width = useResponsiveWidth()
  const canPlot = valuation.status === 'ok' && valuation.projection.length >= 2

  if (!canPlot) {
    return (
      <p className="text-sm text-ink-400">
        Set valid assumptions (terminal growth below WACC) to see the cash-flow projection.
      </p>
    )
  }

  const growthLabel = `${(assumptions.growthRate * 100).toFixed(1)}% growth`
  const last = valuation.projection[valuation.projection.length - 1].freeCashFlow
  const first = valuation.projection[0].freeCashFlow

  return (
    <PeakChart
      width={width}
      data={valuation.projection.map((p) => p.freeCashFlow)}
      labels={valuation.projection.map((p) => `Year ${p.year}`)}
      value={valuation.intrinsicValuePerShare}
      valueSuffix={` ${currency}`}
      decimals={2}
      title="Intrinsic value / share"
      caption="Projected free cash flow by year"
      updatedText={`${assumptions.projectionYears}-year DCF`}
      trend={last >= first ? 'up' : 'down'}
      periods={[growthLabel]}
      period={growthLabel}
      formatValue={(v) => `${currency} ${Math.round(v).toLocaleString()}m`}
    />
  )
}
