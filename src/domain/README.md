# `src/domain/` — pure logic

Rounding, chart scales and input validation rules (the v2 training-domain modules are added in later
stages).

Contents: `number-validation.ts` (generic decimal rules, incl. the `step` rule), `validation.ts`
(profile name and ISO date rules), `rounding.ts` (load increments, rounding modes and `roundLoad`),
`period.ts` (the period filter of the progress charts) and `chart-scale.ts` (nice axis ticks, linear
scales and `buildChartModel`, the pixel coordinates of a line chart for a dated value series).

Dependency rules:

- Pure TypeScript only. **No imports** of React, React Native, Expo, `src/data/`,
  `src/i18n/`, `src/state/` or `src/components/`.
- No I/O, no clocks, no randomness: pass dates and values in as arguments.
- Return error/warning **codes** (e.g. `'aboveMax'`), never display strings. The UI maps
  codes to localized messages.
- Coverage must stay ≥ 95 % lines (enforced by `jest.config.js`, together with `src/library/`).
  Tests use exact, hand-computed expected values.
