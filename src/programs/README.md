# `src/programs/` — program database

Program schema (SPEC §3.2), template data in `data/*.ts`, schema validation and block
selection. Populated from Stage 4 onwards.

Dependency rules:

- Pure TypeScript only. **No imports** of React, React Native, Expo, `src/data/`,
  `src/i18n/`, `src/state/` or `src/components/`. May import types from `src/domain/`.
- Never invent sets, reps or percentages; every template cites its `source`, and
  unconfirmed values are marked `unverified`.
- Human-readable labels are `{ en: string; 'pt-BR'?: string }` (language-neutral data).
- Coverage must stay ≥ 95 % lines (enforced by `jest.config.js` as soon as this folder
  contains code), plus data tests checked against the cited source, day by day.
