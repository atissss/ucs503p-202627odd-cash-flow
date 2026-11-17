import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { runDCF } from '../domain/runDCF'
import { DEFAULT_ASSUMPTIONS, type Assumptions } from '../domain/scenario'
import { SensitivityGrid } from './SensitivityGrid'

const count = (html: string, needle: string) => html.split(needle).length - 1

describe('<SensitivityGrid />', () => {
  it('renders a 7 × 7 grid and highlights exactly the current cell', () => {
    const html = renderToStaticMarkup(<SensitivityGrid assumptions={DEFAULT_ASSUMPTIONS} />)
    // 7 body rows, each with a row header + 7 value cells.
    expect(count(html, '<td ')).toBe(49)
    expect(count(html, 'aria-current="true"')).toBe(1)
    expect(count(html, 'data-invalid')).toBe(0)

    const expected = runDCF(DEFAULT_ASSUMPTIONS).intrinsicValuePerShare
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(expected)
    // The highlighted cell shows the same number runDCF gives for the current inputs.
    expect(html).toMatch(new RegExp(`aria-current="true"[^>]*>${formatted.replace('$', '\\$')}<`))
  })

  it('greys out cells where terminal growth >= WACC instead of showing a number', () => {
    // WACC 5% / g 4%: columns 2%–8%, rows 2.5%–5.5% → plenty of g >= WACC cells.
    const a: Assumptions = { ...DEFAULT_ASSUMPTIONS, wacc: 0.05, terminalGrowth: 0.04 }
    const html = renderToStaticMarkup(<SensitivityGrid assumptions={a} />)
    const invalid = count(html, 'data-invalid="true"')
    expect(invalid).toBeGreaterThan(0)
    expect(invalid).toBeLessThan(49)
    // Every invalid cell shows a dash, none shows a currency amount.
    expect(count(html, '>—</td>')).toBe(invalid)
  })

  it('shows a prompt instead of a table when WACC is not a number', () => {
    const a: Assumptions = { ...DEFAULT_ASSUMPTIONS, wacc: NaN }
    const html = renderToStaticMarkup(<SensitivityGrid assumptions={a} />)
    expect(html).not.toContain('<table')
    expect(html).toContain('valid WACC')
  })

  it('does not throw on an unknown currency code', () => {
    const a: Assumptions = { ...DEFAULT_ASSUMPTIONS, currency: 'not-a-currency' }
    expect(() => renderToStaticMarkup(<SensitivityGrid assumptions={a} />)).not.toThrow()
  })
})
