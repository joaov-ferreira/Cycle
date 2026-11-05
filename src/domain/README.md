# `src/domain/` — pure math engine

Rounding, loads, periodization, RIR/RPE, e1RM, statistics and input validation rules.

Contents: `lifts.ts` (the three lifts), `number-validation.ts` (generic decimal rules, incl.
the `step` rule), `validation.ts` (reference 1RM and profile name rules), `rounding.ts`
(load increments, rounding modes and `roundLoad`, SPEC §5), `periodization.ts`
(`generatePeriodization`: slots × templates × 1RMs × rounding × parameters → three-week
periodization with exact/rounded loads, volume and warning codes, SPEC §4; `findSession` looks
a session up by its key; on multi-lift days only the slot lift's items are calculated, the other lifts'
items go to `otherItems` and a day without work for the slot lift raises `liftNotInDay`) and
`rpe.ts` (RIR ↔ RPE table and conversions, half points, divergence check, SPEC §7),
`performance.ts` (the sets to log from a generated session, field validation, prescribed-vs-actual
comparison, the completion snapshot, snapshot session ids, the queue of pending sessions) and
`session-slots.ts` (slot editing rules: program filtered by lift, day and start week kept in range;
`missingProgramDays` for "Add all days of this program") and `e1rm/` (SPEC §8: `rts-table.ts`, the
transcribed RTS RPE chart with its sources, the unverified cell with its readings and the RTS TRAC
differences as a note;
`estimate.ts`, the formulas `rts`, `epley-rir` and `brzycki-rir` on integer arithmetic, rounded to
0.1 kg, and the validity rules; `session.ts`, the representative set per lift, the candidate sets of a
performed session (named variations excluded) and Δ kg / Δ % against the previous estimate).

Dependency rules:

- Pure TypeScript only. **No imports** of React, React Native, Expo, `src/data/`,
  `src/i18n/`, `src/state/` or `src/components/`. `periodization.ts` may import the pure
  `src/programs/` layer (schema, blocks, parameters).
- No I/O, no clocks, no randomness: pass dates and values in as arguments.
- Return error/warning **codes** (e.g. `'aboveMax'`), never display strings. The UI maps
  codes to localized messages.
- Coverage must stay ≥ 95 % lines (enforced by `jest.config.js`). Tests use exact,
  hand-computed expected values.
