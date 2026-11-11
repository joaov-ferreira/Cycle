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
- v3 (SPEC-v3): `rest-timer.ts` (timer derived from timestamps, superset rule, adjust/skip), `plates.ts`
  (plates per side, integer grams), `warmup.ts` (50/70/85 % ramp), `cycle-report.ts` (adherence, volume,
  per-exercise change, stalled, records, weekly sets per muscle), `body.ts` (body metric validation, series
  and stats), `insights.ts` (calendar, week streak, weekly trends), `backup.ts` (the `cycle-backup`
  document: build, tolerant parse with `{ code, path }` errors, summary, file name, id remapping),
  `logbook-csv.ts` (CSV export) and `exercise-similar.ts` (similar exercises). `cycle.ts` also holds the
  RIR ramp (`weekTargetRir`) and `plan.ts` the superset layout (`supersetLayout`) and its validation.
- v4 (SPEC-v4, strength mode): `reference-max.ts` (per-exercise reference 1RM records, `floorToHalfKg`), `e1rm.ts`
  + `rts-table.ts` (Epley, Brzycki and RTS estimates with confidence), `effort.ts` (RIR ↔ RPE), `focus.ts`,
  `scheme-set.ts` + `percent-scheme.ts` (percent schemes on a plan exercise: validation, scheme week,
  deload transform), `program.ts` (program schema, parameters, `expandProgramDay`), `program-plan.ts`
  (`expandWorkout`, `programToPlan`, `advanceProgramBlocks`, fidelity warnings), `prescription.ts` (loads from
  percentages, tonnage, prescribed vs actual), `strength.ts` (strength dashboard). `cycle-report.ts`,
  `stats.ts` and `metrics.ts` take the e1RM formula (default `epley`).
- `rounding.ts`, `number-validation.ts`, `validation.ts` — generic helpers.

Dependency rules:

- Pure TypeScript only: **no imports** of React, React Native, Expo, `src/data/`, `src/i18n/`, `src/state/`,
  `src/components/`. No I/O, clocks or randomness: pass dates and values in.
- Return error/warning **codes**, never display strings; the UI maps them to localized messages.
- Coverage stays ≥ 95 % lines (with `src/library/`); tests use exact, hand-computed values.
