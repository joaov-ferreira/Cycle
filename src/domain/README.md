# `src/domain/` — pure math engine

Rounding, loads, periodization, RIR/RPE, e1RM, statistics and input validation rules.

Dependency rules:

- Pure TypeScript only. **No imports** of React, React Native, Expo, `src/data/`,
  `src/i18n/`, `src/state/` or `src/components/`.
- No I/O, no clocks, no randomness: pass dates and values in as arguments.
- Return error/warning **codes** (e.g. `'aboveMax'`), never display strings. The UI maps
  codes to localized messages.
- Coverage must stay ≥ 95 % lines (enforced by `jest.config.js`). Tests use exact,
  hand-computed expected values.
