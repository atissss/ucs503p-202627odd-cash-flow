import { describe, expect, it } from 'vitest'

import { toCamelCase, toSnakeCase } from './casing'

describe('casing adapter', () => {
  it('converts nested payload keys to snake_case for the backend', () => {
    const payload = {
      name: 'AAPL — Base',
      kind: 'base',
      dataStatus: 'manual',
      ticker: null,
      assumptions: {
        baseFreeCashFlow: 1000,
        growthRate: 0.08,
        wacc: 0.09,
        terminalGrowth: 0.025,
        projectionYears: 5,
        netDebt: 0,
        sharesOutstanding: 1000,
        currency: 'USD',
      },
      valuation: {
        status: 'ok',
        projection: [{ year: 1, freeCashFlow: 110, discountFactor: 0.91, presentValue: 100 }],
        pvOfProjection: 300,
        terminalValue: 1697,
        pvOfTerminalValue: 1275,
        enterpriseValue: 1575,
        equityValue: 1525,
        intrinsicValuePerShare: 1.53,
      },
    }

    expect(toSnakeCase(payload)).toEqual({
      name: 'AAPL — Base',
      kind: 'base',
      data_status: 'manual',
      ticker: null,
      assumptions: {
        base_free_cash_flow: 1000,
        growth_rate: 0.08,
        wacc: 0.09,
        terminal_growth: 0.025,
        projection_years: 5,
        net_debt: 0,
        shares_outstanding: 1000,
        currency: 'USD',
      },
      valuation: {
        status: 'ok',
        projection: [
          { year: 1, free_cash_flow: 110, discount_factor: 0.91, present_value: 100 },
        ],
        pv_of_projection: 300,
        terminal_value: 1697,
        pv_of_terminal_value: 1275,
        enterprise_value: 1575,
        equity_value: 1525,
        intrinsic_value_per_share: 1.53,
      },
    })
  })

  it('converts a backend response back to camelCase', () => {
    const response = {
      id: 'abc-123',
      name: 'AAPL — Base',
      kind: 'base',
      data_status: 'manual',
      ticker: null,
      assumptions: { base_free_cash_flow: 1000, shares_outstanding: 1000, currency: 'USD' },
      valuation: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }

    expect(toCamelCase(response)).toEqual({
      id: 'abc-123',
      name: 'AAPL — Base',
      kind: 'base',
      dataStatus: 'manual',
      ticker: null,
      assumptions: { baseFreeCashFlow: 1000, sharesOutstanding: 1000, currency: 'USD' },
      valuation: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })
  })

  it('leaves string values (e.g. hyphenated statuses) untouched', () => {
    expect(toSnakeCase({ status: 'not-computed', kind: 'bull' })).toEqual({
      status: 'not-computed',
      kind: 'bull',
    })
  })

  it('round-trips camel → snake → camel without loss', () => {
    const original = {
      dataStatus: 'manual',
      assumptions: { baseFreeCashFlow: 1000, intrinsicValuePerShare: 1.5 },
    }
    expect(toCamelCase(toSnakeCase(original))).toEqual(original)
  })
})
