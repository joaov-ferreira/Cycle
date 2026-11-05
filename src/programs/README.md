# `src/programs/` — program database

Program schema (SPEC §3.2), template data in `data/*.ts`, schema validation and block
selection.

- `schema.ts` — types (`ProgramTemplate`, `SetPrescription`, `ConfigurableParam`, …).
- `validate.ts` — `validateTemplate` returns issue codes with a path; `registry.test.ts`
  runs it on every registered template.
- `registry.ts` — `listTemplates`, `findTemplate`, `templatesForLift`. Register new templates here.
- `blocks.ts` — `getBlock(template, startWeek)` (3 weeks, partial at the end), `maxBlockStartWeek`.
- `params.ts` — range checks for configurable parameters, `resolveParamValues`,
  `resolveTemplate` (applies the athlete's values to percent-linked sets), `totalSets`.
- `localized.ts` — `pickLocalized` (English fallback).
- `data/cycle-531-custom.ts` — SPEC §3.3-A.
- `data/smolov-jr.ts` — SPEC §3.3-C (sources and transcription notes in `docs/DECISIONS.md`, Stage 7).
  `addKg: { param, times }` adds `times ×` a `kg` parameter (week 3 = twice the weekly increment).
- `data/smolov.ts` — SPEC §3.3-B, 13 weeks (sources in `docs/DECISIONS.md`, Stage 8). Fixed
  increments use `addKg: { kg }`; rest days, 1RM tests and the unverified switching phase are
  `kind: 'info'` items (text, optional note, optional `unverified`), which carry no load.
  `addKgValue` (params.ts) resolves both increment forms.
- `data/sheiko-29.ts`, `sheiko-30.ts`, `sheiko-31.ts`, `sheiko-32.ts`, `sheiko-37.ts` — SPEC §3.3-D, one
  file per numbered routine (4 weeks × 3 days, all three lifts), with the shared source, names and
  helpers in `data/sheiko-common.ts` (sources in `docs/DECISIONS.md`, Stage 9). Variations of a lift
  (`MainItem.exercise`, e.g. "Deadlift from boxes") are percentages of the competition lift's 1RM;
  lift-tied informational lines use `InfoItem.lift`; `ProgramTemplate.variant` is the short label (`#29`).
  `groupByFamily` (registry.ts) groups templates of one family for the UI.

Dependency rules:

- Pure TypeScript only. **No imports** of React, React Native, Expo, `src/data/`,
  `src/i18n/`, `src/state/` or `src/components/`. May import types from `src/domain/`.
- Never invent sets, reps or percentages; every template cites its `source`, and
  unconfirmed values are marked `unverified`.
- Human-readable labels are `{ en: string; 'pt-BR'?: string }` (language-neutral data).
- Coverage must stay ≥ 95 % lines (enforced by `jest.config.js` as soon as this folder
  contains code), plus data tests checked against the cited source, day by day.
