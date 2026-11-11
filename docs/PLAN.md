# CYCLE v2 — Implementation Plan

> Implements [`SPEC.md`](./SPEC.md) (v2: general weight-training logbook) following the rules in
> [`../AGENTS.md`](../AGENTS.md). The v1 plan is archived in
> [`archive/PLAN-v1.md`](./archive/PLAN-v1.md).

## How this plan works

- The whole v2 migration is developed on **one integration branch**,
  `claude/bodybuilding-training-app-lr6egj`, and lands on `main` through **one PR** at the end
  (owner instruction for this migration; it replaces the "one stage = one PR" rule of v1).
- An **orchestrator** writes the spec and this plan, delegates every stage to a sub-agent, reviews the
  result (runs `npm test`, `npx expo lint`, `npx tsc --noEmit`, reads the diff against the SPEC) and
  integrates it. The orchestrator writes no production code except trivial fixes (≤ 10 lines).
- Each stage is executed by **one clean-context sub-agent** of the indicated model. Policy: start with
  the cheapest model that can plausibly do the stage; when a stage fails review after its fix rounds,
  re-run it one tier higher (**haiku → sonnet → opus**).
- **TDD is mandatory** (red → green → refactor, see AGENTS.md). Tests use hand-computed expected
  values taken from the SPEC examples.
- Stages in the same **wave** run in parallel, each in its own git worktree on a local branch
  `v2/<stage-id>`; the orchestrator merges them into the integration branch after review. To keep
  parallel stages mergeable, a parallel stage touches **only the paths listed under "Owns"** and
  never edits `README.md`, `docs/*`, `AGENTS.md`, `package.json` or another stage's files; it reports
  decisions in its final message and the orchestrator records them in `docs/DECISIONS.md`.
- Every stage that adds UI adds its strings to both locales, in its own catalog namespace files
  (`src/i18n/locales/en/<namespace>.ts` and `pt-BR/<namespace>.ts`).

### Status

| Stage | Wave | Scope | Model | Status |
|---|---|---|---|---|
| 0 | — | Spec v2, plan v2, AGENTS.md update | orchestrator | ✅ |
| 1 | 1 | Remove v1 features, v2 skeleton (routes, tabs, catalogs split) | sonnet | ⬜ |
| 2 | 2 | Domain types, metrics, rounding helpers | haiku | ⬜ |
| 3a | 3 | Built-in exercise library + registry | haiku | ⬜ |
| 3b | 3 | Exercise matching, plan validation, import/export | sonnet | ⬜ |
| 3c | 3 | Cycle engine, progression engine, deload advice | sonnet | ⬜ |
| 3d | 3 | Workout validation, stats (PRs, weekly volume, chart series) | haiku | ⬜ |
| 3e | 3 | Persistence: migration 010, repositories, v1 data carry-over | sonnet | ⬜ |
| 4a | 4 | Built-in plan templates | haiku | ⬜ |
| 4b | 4 | State store and selectors | sonnet | ⬜ |
| 4c | 4 | Shared UI: exercise picker, set row, stepper | haiku | ⬜ |
| 4d | 4 | AI prompt builder, generated prompt docs, schema consistency tests | haiku | ⬜ |
| 5a | 5 | Exercises screens | sonnet | ⬜ |
| 5b | 5 | Plan screens: list, detail, editor, cycle card | sonnet | ⬜ |
| 5c | 5 | New-plan flow: templates gallery, import, export | sonnet | ⬜ |
| 5d | 5 | Workout logger and summary | sonnet | ⬜ |
| 5e | 5 | History and Progress screens | sonnet | ⬜ |
| 5f | 5 | Home, onboarding, settings | haiku | ⬜ |
| 6 | 6 | Integration: E2E acceptance flow, audits, README, screenshots | sonnet | ⬜ |
| 7 | — | Final review, PR, CI, merge, APK release check | orchestrator | ⬜ |

Legend: ⬜ pending · 🟨 in progress · ✅ done · ⚠️ done with a recorded gap. The "Model" column shows
the starting model; escalations are recorded in `docs/DECISIONS.md`.

---

## Stage 1 — Remove v1, build the v2 skeleton · sonnet

**Goal:** a green, compiling app that contains only what v2 keeps, with empty v2 screens.

1. **Delete** the v1 powerlifting features: `src/programs/`; domain modules `lifts`, `periodization`,
   `session-slots`, `block-progress`, `performance`, `history`, `rpe`, `e1rm/`, `stats`, the
   1RM rules in `validation`; the repositories and store slices for reference 1RMs, rounding
   settings, program params, session slots, periodizations, performances and e1RM history (interfaces,
   memory, sqlite, contract tests); all v1 feature components, routes, selectors, test utilities and
   their tests; `src/e2e/spec-flow.test.tsx`; v1-only i18n keys.
2. **Keep and keep green:** migrations 001–009 and their tests (immutable), the migration runner,
   `SqlDatabase`, node-sqlite test utility, profiles + settings repositories (settings keeps
   `language`, `theme`, `onboardingCompleted`; `e1rmFormula` is dropped from the type, the column
   stays), bootstrap, `domain/rounding.ts` (`roundLoad`), `domain/number-validation.ts`,
   `domain/chart-scale.ts` (generalize names if they mention e1RM), `validateProfileName` and
   `validateIsoDate`, i18n infrastructure and formatters, theme, UI primitives, `line-chart`,
   navigation shell (tabs + sidebar), settings screen with the language, theme and profile sections,
   the no-hard-coded-strings test, CI, Docker/APK pipeline, signing plugin.
3. **Skeleton:** tabs Home / Plan / Workout / Progress / More and every route of SPEC §12 as a
   placeholder screen (localized title only); sidebar entries per SPEC §12; onboarding gate reduced to
   a pass-through (re-implemented in stage 5f).
4. **i18n:** split the catalogs by namespace (`src/i18n/locales/en/<ns>.ts`, `pt-BR/<ns>.ts`, composed
   in `en.ts` / `pt-BR.ts`); create empty-or-title-only namespaces for `home`, `plan`, `planImport`,
   `workout`, `history`, `progress`, `exercises`, `picker`, `onboarding`, `settings`, `common`.
5. **Config:** jest strict layers become `src/domain` and `src/library`; `app.json` version `2.0.0`;
   `package.json` version `2.0.0`.
6. README: replace the v1 feature description with a short "v2 in progress" note (the full rewrite
   is stage 6).

Acceptance: `npm test`, `npx expo lint`, `npx tsc --noEmit` green; no import of a deleted module; `git
grep -i -E "smolov|sheiko|1rm"` matches only migrations 001–009, their tests and `docs/`.

## Stage 2 — Domain types and metrics · haiku

Owns: `src/domain/exercise.ts`, `plan.ts` (types and constants only), `cycle.ts` (types and
`INITIAL_CYCLE_STATE` only), `workout.ts` (types only), `metrics.ts`, and additions to `rounding.ts`.

- Transcribe the types and constants of SPEC §2.1, §3.1, §5.2, §7.1 exactly (names included), plus
  type guards `isMuscleGroup`, `isEquipment`, `allowsZeroLoad(equipment)`, `DEFAULT_INCREMENT_KG`,
  `incrementFor`, `DEFAULT_CYCLE`.
- `metrics.ts` per SPEC §6.1: `countedSets`, `e1rm`, `setVolume`, `volume`, `workLoad`,
  `setsAtWorkLoad`, `sessionScore`.
- `rounding.ts`: `floorToIncrement`, `roundToIncrementTiesDown` (reuse `roundLoad`), exact arithmetic.

Tests first, with the SPEC's hand-computed examples. Acceptance: checks green, domain coverage ≥ 95 %.

## Wave 3 (parallel)

### 3a — Built-in exercise library · haiku

Owns: `src/library/exercises/**`, `src/library/index.ts`.
SPEC §2.2: ≥ 150 exercises grouped in one data file per primary muscle; registry `listExercises()`,
`findExercise(id)`; data tests for ids, names, alias/name uniqueness after normalization, coverage per
muscle group and equipment, the contract ids. Normalization is implemented locally in the test helper
if stage 3b's `normalizeName` is not available (same rule as SPEC §4.3).

### 3b — Matching, plan validation, import/export · sonnet

Owns: `src/domain/exercise-match.ts`, `src/domain/plan.ts` (adds `validatePlanContent` and helpers
below the stage 2 types), `src/domain/plan-import.ts`, `src/domain/plan-export.ts`.
SPEC §3.1 validation, §4.1–§4.4 and `docs/IMPORT_FORMAT.md` (normative for the JSON format: limits,
defaults, error codes, `startLoad`, ignoring unknown properties, extracting JSON from a chatbot
answer): `normalizeName`, `matchExercise`, `suggestExercises`, `detectFormat`,
JSON and plain-text parsers with line-numbered error codes, the import draft
(resolved / newCustom / unresolved) and `resolveDraft` (apply the user's choices → `PlanContent` +
custom exercises to create), `exportPlan`, round-trip test. Tests use a small fixture exercise list
(not the full library).

### 3c — Cycle and progression engines · sonnet

Owns: `src/domain/cycle.ts` (adds functions below the stage 2 types), `src/domain/progression.ts`.
SPEC §5.1–§5.4 and §6.2–§6.3: `suggestCycle`, `completeSession`, `startDeload`, `startNewCycle`,
`deloadSets`, `deloadLoad`, `deloadAdvice`, `suggest` (all seven rows of the §6.2 table as tests, plus
edge cases: zero-load equipment, off-grid loads, fewer sets than planned, mixed weights, warm-ups
ignored, deload sessions ignored), `isStalled`.

### 3d — Workout validation and stats · haiku

Owns: `src/domain/workout.ts` (adds validation below the stage 2 types), `src/domain/stats.ts`.
SPEC §7.1 field rules (`validateSet`, `validateWorkoutForCompletion`, error codes), `workoutSummary`
(duration, sets, volume), §9: chart series per metric (`exerciseSeries`), period filter, PRs
(`personalRecords`, `newRecords`), weekly sets per muscle group (`weeklyMuscleSets`, ISO week).

### 3e — Persistence · sonnet

Owns: `src/data/**` (except what stage 1 kept unchanged in behavior), `src/test-utils/node-sqlite.ts`
if needed.
SPEC §11.2–§11.3: migration `010_v2_logbook` (new tables, settings columns, v1 carry-over with
migration tests on real SQLite), `ExerciseRepository`, `PlanRepository`, `WorkoutRepository`
interfaces, in-memory and SQLite implementations, shared contract tests, `Settings.experience`.
Repository methods needed by later stages: custom exercise CRUD/archive/delete-if-unreferenced,
increment overrides; plan create/update/archive/delete/list/get, active plan id, cycle state update;
workout save draft / get in-progress / complete / amend / delete / list completed (filters: plan,
exercise) / sessions of an exercise (newest first, with phase and cycle number).

## Wave 4 (parallel)

### 4a — Plan templates · haiku

Owns: `src/library/plan-templates/**` and its export in `src/library/index.ts`.
SPEC §3.3: the six templates, registry (`listPlanTemplates()`, `findPlanTemplate(id)`,
`instantiateTemplate(template, locale): PlanContent`), data tests for every rule of §3.3.

### 4b — State store · sonnet

Owns: `src/state/**`, `src/components/app-providers.tsx`, `src/test-utils/**`.
Zustand store over the repositories and the domain: boot (profile, settings, exercises, plans, active
plan, in-progress workout, history); exercise actions (custom CRUD, increment override); plan actions
(create from content/template/import draft, update, duplicate, archive, delete, activate, cycle
config, cycle actions); workout actions (start from plan with suggestions, start free, every logging
edit persisted, finish → cycle advance, discard, amend, delete); settings (experience, onboarding).
Memoized selectors: all exercises (built-in + custom), suggestions for a plan workout, deload advice,
home summary, history list/filters, exercise sessions, progress series, PRs, weekly muscle sets.
Store tests run on the in-memory repositories; test utilities to seed a plan and logged workouts.

### 4d — AI prompt and format docs · haiku

Owns: `src/library/ai-prompt.ts` (+ test), `scripts/generate-ai-prompt.*`, `docs/AI_PLAN_PROMPT.md`,
`docs/AI_PLAN_PROMPT.pt-BR.md`, `src/library/import-format.test.ts`, the `docs:prompt` script entry in
`package.json` (the only edit allowed there).
SPEC §4.5 and IMPORT_FORMAT.md §8: `buildAiPlanPrompt` with the two templates copied verbatim from
the spec, the generator script, the staleness test, the schema-consistency test and the test that
imports the IMPORT_FORMAT.md §7 example against the real library.

### 4c — Shared UI · haiku

Owns: `src/components/shared/**`, i18n namespaces `picker` and `common`.
Presentational, prop-driven components with RNTL tests: `ExercisePicker` (search, muscle and equipment
filters, select, "create new" callback), `SetRow` (weight/reps/RIR inputs, done toggle, warm-up
toggle, placeholders, error display), `Stepper` (integer ± control), `ConfirmDialog`, `EmptyState`.

## Wave 5 (parallel) — screens

Each stage owns one folder under `src/components/`, its routes in `src/app/` (created as placeholders
in stage 1) and its i18n namespace(s). Screens read and write only through the store.

- **5a — Exercises · sonnet.** `src/components/exercises/**`, routes `exercises/*`; namespace
  `exercises`. SPEC §2.3–§2.4.
- **5b — Plan · sonnet.** `src/components/plan/**`, routes `(tabs)/plan`, `plans/index`,
  `plans/[id]`, `plans/[id]/edit`; namespace `plan`. SPEC §3.2, §5.5.
- **5c — New plan, import, export · sonnet.** `src/components/plan-import/**`, routes `plans/new`,
  `plans/templates`, `plans/import`; namespace `planImport`. SPEC §3.3, §4.3–§4.5 (including the **Create with AI** prompt view). Adds
  `expo-document-picker` (and `expo-file-system` only if required to read the picked file) with
  `npx expo install`, after reading the SDK 58 docs. This is the only stage of the wave allowed to
  touch `package.json`/`package-lock.json`/`app.json`.
- **5d — Workout logger · sonnet.** `src/components/workout/**`, route `(tabs)/workout`; namespace
  `workout`. SPEC §6.4, §7.
- **5e — History and Progress · sonnet.** `src/components/history/**`, `src/components/progress/**`,
  routes `history/*`, `(tabs)/progress`; namespaces `history`, `progress`. SPEC §8, §9.
- **5f — Home, onboarding, settings · haiku.** `src/components/home/**`,
  `src/components/onboarding/**`, `src/components/settings/**`, routes `(tabs)/index`, `(tabs)/more`,
  `settings`; namespaces `home`, `onboarding`, `settings`. SPEC §10.

## Stage 6 — Integration · sonnet

- E2E acceptance test of SPEC §13 (`src/e2e/spec-flow.test.tsx`, in-memory repositories, both
  locales at step 9).
- Cross-screen audit: navigation between every route, accessibility labels, i18n catalog parity,
  number formatting in pt-BR, empty states, wide-screen sidebar.
- Run the app on web (`npx expo start --web`) and fix what the tests did not catch; regenerate the
  README screenshots in `docs/images/` (remove the v1 ones).
- Rewrite `README.md` for v2 (features, how load progression works, import formats with examples,
  architecture, commands, APK), including the section **"Create a plan with an AI chatbot"**: the four
  steps of IMPORT_FORMAT.md §8.3, links to the prompt files and to the data specification.
- Coverage thresholds hold; remove dead code and unused keys.

## Stage 7 — Final review and release · orchestrator

Full review of the branch against the SPEC, PR to `main`, CI green, squash merge, verify the
`Android APK` workflow run on `main` and the `latest-main` pre-release.
