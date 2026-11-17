# Week 1 — Weekly Progress Update

## Progress
- Derived and verified the complete DCF valuation flow from FCF projection to intrinsic value per share.
- Worked through the reference case manually and established **$17.66/share** as the expected valuation output.
- Built a Python notebook to independently test each DCF formula and reproduce the reference case.
- Added automated checks for the **terminal growth < WACC** guardrail and basic valuation sanity checks.
- Added a zero-growth edge case and a preliminary **WACC × terminal-growth sensitivity grid** to understand model behavior.
- The notebook will serve as the **numeric oracle** for testing `runDCF()` during Week 2.

## Next Week
- Finalize the DCF assumptions/data structure with the team.
- Translate the validated formulas into the `runDCF()` module.
- Use the Week 0 notebook outputs as reference values for unit testing.