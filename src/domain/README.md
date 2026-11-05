# `src/domain/` — pure math engine

Rounding, loads, periodization, RIR/RPE, e1RM, statistics and input validation rules.

Contents: `lifts.ts` (the three lifts), `number-validation.ts` (generic decimal rules, incl.
the `step` rule), `validation.ts` (reference 1RM and profile name rules), `rounding.ts`
(load increments, rounding modes and `roundLoad`, SPEC §5), `periodization.ts`
(`generatePeriodization`: slots × templates × 1RMs × rounding × parameters → three-week
periodization with exact/rounded loads, volume and warning codes, SPEC §4; `findSession` looks
a session up by its key) and
`session-slots.ts` (slot editing rules: program filtered by lift, day and start week kept in range;
`missingProgramDays` for "Add all days of this program").

Dependency rules:

- Pure TypeScript only. **No imports** of React, React Native, Expo, `src/data/`,
  `src/i18n/`, `src/state/` or `src/components/`. `periodization.ts` may import the pure
  `src/programs/` layer (schema, blocks, parameters).
- No I/O, no clocks, no randomness: pass dates and values in as arguments.
- Return error/warning **codes** (e.g. `'aboveMax'`), never display strings. The UI maps
  codes to localized messages.
- Coverage must stay ≥ 95 % lines (enforced by `jest.config.js`). Tests use exact,
  hand-computed expected values.
