# `src/domain/` — pure logic

Everything that decides something, with no framework in sight.

- `exercise.ts` (model, muscle groups, equipment, load increments), `exercise-match.ts` (name normalization,
  matching, suggestions, custom-exercise validation).
- `plan.ts` (plan model, limits, `validatePlanContent`), `plan-import.ts` (text and JSON parsers, import draft,
  resolution), `plan-export.ts`.
- `cycle.ts` (cycle state machine, deload prescription and advice, `suggestCycle`, timeline),
  `progression.ts` (double progression, stall detection), `metrics.ts` (e1RM, volume, work load, session score).
- `workout.ts` (logged workout model and validation), `workout-builder.ts` (draft from a plan workout),
  `stats.ts` (chart series, personal records, weekly muscle sets), `period.ts`, `chart-scale.ts`.
- `rounding.ts`, `number-validation.ts`, `validation.ts` — generic helpers.

Dependency rules:

- Pure TypeScript only: **no imports** of React, React Native, Expo, `src/data/`, `src/i18n/`, `src/state/`,
  `src/components/`. No I/O, clocks or randomness: pass dates and values in.
- Return error/warning **codes**, never display strings; the UI maps them to localized messages.
- Coverage stays ≥ 95 % lines (with `src/library/`); tests use exact, hand-computed values.
