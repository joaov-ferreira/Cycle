# `src/library/` — built-in data

Pure data and the pure code that formats it.

- `exercises/` — the built-in exercise library (150+ entries, one file per primary muscle) and its registry
  (`listExercises()`, `findExercise(id)`).
- `plan-templates/` — the six built-in plans (`full-body-3x`, `upper-lower-4x`, `push-pull-legs`, `abc`, `abcd`,
  `abcde`), `listPlanTemplates()`, `findPlanTemplate(id)`, `instantiateTemplate(template, locale)`.
- `ai-prompt.ts` — `buildAiPlanPrompt(exercises, locale)`, the chatbot prompt of docs/IMPORT_FORMAT.md §8;
  `npm run docs:prompt` writes `docs/AI_PLAN_PROMPT*.md` from it.

Data tests check ids, names, aliases, coverage, template rules, that the prompt files are fresh and that the
JSON schema matches the domain constants.

Dependency rules: like `src/domain/` — no React, Expo, `data/`, `state/` or `i18n/` imports; types and
validators from `src/domain/` are fine. Coverage ≥ 95 % lines.
