# `src/library/` — built-in data

Pure data and the pure code that formats it.

- `exercises/` — the built-in exercise library (150+ entries, one file per primary muscle) and its registry
  (`listExercises()`, `findExercise(id)`).
- `programs/` — the strength program library (custom 5/3/1, Smolov Jr., Smolov, Sheiko #29/#30/#31/#32/#37):
  `PROGRAMS`, `findProgram(id)`, `programsByFamily()`. The numbers are the v1 transcriptions, pinned by a
  snapshot test (`v1-snapshot.test.ts`); each program keeps its source, version and verification.
- `plan-templates/` — the built-in plans (`full-body-3x`, `upper-lower-4x`, `push-pull-legs`, `abc`, `abcd`,
  `abcde`, and the hybrid `hybrid-531` with custom 5/3/1 blocks), `listPlanTemplates()`, `findPlanTemplate(id)`, `instantiateTemplate(template, locale)`.
- `ai-prompt.ts` — `buildAiPlanPrompt(exercises, locale)`, the chatbot prompt of docs/IMPORT_FORMAT.md §8;
  `npm run docs:prompt` writes `docs/AI_PLAN_PROMPT*.md` from it. `AI_PLAN_PROMPT_TEMPLATE` is identical to
  the two templates of docs/IMPORT_FORMAT.md §8.1/§8.2 (a test compares them character by character).
- `ai-review-prompt.ts` — `buildAiReviewPrompt(input)` (SPEC-v3 §7): the header (identical to the two
  blocks of docs/SPEC-v3.md §7), the plan JSON, the per-exercise session lines (`40×12@2`, `d` = drop set)
  and the OUTPUT section of the plan prompt. Takes plain data, no store.

Data tests check ids, names, aliases, coverage, template rules, that the prompt files are fresh, that the
templates match the documents, that the JSON schema (including `superset`, `cycle.rirRamp`, `percent`,
`programs` and `referenceMaxes`) matches the domain constants and that the programs match their v1 snapshot.

Dependency rules: like `src/domain/` — no React, Expo, `data/`, `state/` or `i18n/` imports; types and
validators from `src/domain/` are fine. Coverage ≥ 95 % lines.
