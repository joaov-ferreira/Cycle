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

Dependency rules:

- Pure TypeScript only. **No imports** of React, React Native, Expo, `src/data/`,
  `src/i18n/`, `src/state/` or `src/components/`. May import types from `src/domain/`.
- Never invent sets, reps or percentages; every template cites its `source`, and
  unconfirmed values are marked `unverified`.
- Human-readable labels are `{ en: string; 'pt-BR'?: string }` (language-neutral data).
- Coverage must stay ≥ 95 % lines (enforced by `jest.config.js` as soon as this folder
  contains code), plus data tests checked against the cited source, day by day.
