# Week 0 — Research & Prerequisites (Valuation Maths)

*Date:* 2026-08-24 (week before kickoff)
*Author:* Aatish Kumar Sahu (1024030790)
*Milestone:* Pre-Month 1 — groundwork, no code

## Goal
I'm anchoring the valuation engine, so my Week 0 was spent deriving the DCF
maths on paper and working one example by hand end-to-end. The aim: know exactly
what the engine must compute, and have a numeric "oracle" to unit-test runDCF
against in Week 2 — before any code exists.

## The DCF formulas

*1. Free-cash-flow projection.* From a base $FCF_0$ growing at rate $g$ over an
explicit horizon of $N$ years:
$$FCF_t = FCF_0 \,(1+g)^t, \qquad t = 1, \dots, N$$

*2. Discounting.* Each year is discounted at the WACC, $r$:
$$DF_t = \frac{1}{(1+r)^t}, \qquad PV_t = FCF_t \cdot DF_t$$

*3. Present value of the explicit period.*
$$PV_{\text{explicit}} = \sum_{t=1}^{N} \frac{FCF_t}{(1+r)^t}$$

*4. Terminal value* (Gordon growth / perpetuity), with perpetual growth
$g_T$:
$$TV_N = \frac{FCF_N\,(1+g_T)}{r - g_T}, \qquad PV_{TV} = \frac{TV_N}{(1+r)^N}$$
This is only defined when $r > g_T$ — as $g_T \to r$ the denominator $\to 0$ and
the value diverges. *That is our hard guardrail: terminal growth < WACC.*

*5. From enterprise value to per share.*
$$EV = PV_{\text{explicit}} + PV_{TV}, \quad
E = EV - \text{NetDebt}, \quad
\text{Value/share} = \frac{E}{\text{Shares}}$$

## Worked reference case (by hand)

Inputs: $FCF_0 = 100$m, $g = 8\%$, $N = 5$, $r = 10\%$, $g_T = 3\%$,
NetDebt $= 50$m, Shares $= 100$m.

| $t$ | $FCF_t$ | $DF_t = 1/1.1^t$ | $PV_t$ |
|----:|--------:|-----------------:|-------:|
| 1 | 108.00 | 0.9091 | 98.18 |
| 2 | 116.64 | 0.8264 | 96.40 |
| 3 | 125.97 | 0.7513 | 94.64 |
| 4 | 136.05 | 0.6830 | 92.92 |
| 5 | 146.93 | 0.6209 | 91.23 |

- $PV_{\text{explicit}} = 473.38$m
- $TV_5 = \dfrac{146.93 \times 1.03}{0.10 - 0.03} = 2162.01$m
- $PV_{TV} = 2162.01 \times 0.6209 = 1342.44$m
- $EV = 473.38 + 1342.44 = 1815.82$m
- $E = 1815.82 - 50 = 1765.82$m
- *Intrinsic value/share $= 1765.82 / 100 = \$17.66$*

This becomes reference test case #1 for the engine in Week 2.

## Sensitivity intuition (why this matters)
- The terminal value dominates: here $PV_{TV}$ is ~74% of $EV$, so the result is
  driven mostly by $r$ and $g_T$, the two hardest inputs to pin down.
- Because $TV_N \propto \frac{1}{r - g_T}$, the output is most sensitive exactly
  where $r$ and $g_T$ are close — this is what the Week 4 WACC × terminal-growth
  sensitivity grid must expose visually.

## Team & process
- Reviewed the proposal and 12-week plan; agreed I'd own the engine, testing,
  and evaluation (weeks 2, 9, 11), pairing up on the hard weeks.
- Will produce 2–3 more hand-worked cases (including a $g = 0$ and a high-growth
  case) so the Week 2 test suite covers the edges, not just the happy path.

## Open questions / risks
- Whether to project FCF from a single base + growth or accept a per-year FCF
  vector — affects the Assumptions shape we lock in Week 1.
- Reference companies for the Week 11 accuracy check — finalize with the
  finance-API choice.

## Next (Week 1 / Week 2)
- Help finalize and record the scenario data model in Week 1, then implement
  runDCF as a pure, tested module in Week 2 and check it against the
  hand-worked value above ($\$17.66$/share).