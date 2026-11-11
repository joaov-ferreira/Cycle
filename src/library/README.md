# `src/library/` — built-in data

Pure data and the pure code that formats it.

- `exercises/` — the built-in exercise library (150+ entries, one file per primary muscle) and its registry
  (`listExercises()`, `findExercise(id)`).
- `plan-templates/` — the six built-in plans (`full-body-3x`, `upper-lower-4x`, `push-pull-legs`, `abc`, `abcd`,
  `abcde`), `listPlanTemplates()`, `findPlanTemplate(id)`, `instantiateTemplate(template, locale)`.
- `ai-prompt.ts` — `buildAiPlanPrompt(exercises, locale)`, the chatbot prompt of docs/IMPORT_FORMAT.md §8;
  `npm run docs:prompt` writes `docs/AI_PLAN_PROMPT*.md` from it. `AI_PLAN_PROMPT_TEMPLATE` is identical to
  the two templates of docs/IMPORT_FORMAT.md §8.1/§8.2 (a test compares them character by character).
- `ai-review-prompt.ts` — `buildAiReviewPrompt(input)` (SPEC-v3 §7): the header (identical to the two
  blocks of docs/SPEC-v3.md §7), the plan JSON, the per-exercise session lines (`40×12@2`, `d` = drop set)
  and the OUTPUT section of the plan prompt. Takes plain data, no store.

Data tests check ids, names, aliases, coverage, template rules, that the prompt files are fresh, that the
templates match the documents and that the JSON schema (including `superset` and `cycle.rirRamp`) matches
the domain constants.

Dependency rules: like `src/domain/` — no React, Expo, `data/`, `state/` or `i18n/` imports; types and
validators from `src/domain/` are fine. Coverage ≥ 95 % lines.
