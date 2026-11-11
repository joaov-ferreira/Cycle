# CYCLE v4 — Implementation Plan

> Implements [`SPEC-v4.md`](./SPEC-v4.md) ("strength mode") on top of v2 ([`SPEC.md`](./SPEC.md)) and
> v3 ([`SPEC-v3.md`](./SPEC-v3.md)), following [`../AGENTS.md`](../AGENTS.md). The v3 plan is archived
> in [`archive/PLAN-v3.md`](./archive/PLAN-v3.md). v3 was merged into `main` in PR #3.

## How this plan works

Same method as v2 and v3:

- One integration branch (`claude/bodybuilding-training-app-lr6egj`, restarted from `main` after the
  v3 merge), one PR to `main` at the end, squash merge, APK verified on `main`.
- The orchestrator writes the spec and this plan, delegates every stage to a clean-context sub-agent,
  reviews (runs `npm test -- --coverage`, `npx expo lint`, `npx tsc --noEmit`, reads the diff against
  the spec) and integrates. No production code by the orchestrator beyond trivial fixes (≤ 10 lines).
- Model policy: the cheapest model that can plausibly do the stage; escalate **haiku → sonnet →
  opus** when a stage fails review after its fix rounds.
- TDD is mandatory; tests use the hand-computed examples of the spec.
- Stages of a wave run in parallel, each in its own git worktree, touching only the paths under
  "Owns"; they never edit `README.md`, `docs/*`, `AGENTS.md` or `package.json` unless the stage says
  so. New UI strings go in the stage's own catalog namespaces, in both locales.
- The v1 code a stage restores is read from git history: `git show 3774916:<path>`.

### Kick-off (orchestrator)

- Branch restarted from `main`; `docs/PLAN.md` (v3) moved to `docs/archive/PLAN-v3.md`; this file and
  `docs/SPEC-v4.md` added; AGENTS.md lists SPEC-v4 and the v4 exception.
- Shared type file `src/domain/scheme-set.ts` (`SchemeSet`, `SchemeWeek`; SPEC-v4 §5.1), so the
  parallel stages of wave 1 agree on it.
- Empty catalog namespaces `programs`, `strength`, `maxes` registered in both locales.
- Before wave 2: the three type fields `PlanExercise.percent`, `PlanWorkout.programs` and
  `WorkoutExercise.prescription` are added to the model (types only), so 2a and 2b run in parallel.

### Status

| Stage | Wave | Scope | Model | Status |
|---|---|---|---|---|
| 0 | — | User journeys, spec v4, plan v4 | orchestrator | ✅ |
| 1a | 1 | e1RM formulas, RTS chart, confidence, effort scale, half-point RIR | haiku | ⬜ |
| 1b | 1 | Reference 1RM, percent schemes, prescriptions, prescribed vs actual, strength dashboard | sonnet | ⬜ |
| 1c | 1 | Program schema and functions, program data restored from v1, library exercises for variations and accessories | sonnet | ⬜ |
| 2a | 2 | Plan model: percent schemes and program blocks, validation, `expandWorkout`, builder, `programToPlan`, import/export (JSON and text), hybrid template, AI prompt builders | sonnet | ⬜ |
| 2b | 2 | Persistence: migration 012, reference-max repository, settings, plan/workout fields, v1 carry-over, backup and CSV | sonnet | ⬜ |
| 3 | 3 | State store: reference maxes, settings, effective workouts and prescriptions, logging rules, rest days, block advance, strength selectors, cycle-report additions | sonnet | ⬜ |
| 4a | 4 | Logger and summary: prescriptions, tick-to-confirm reps, AMRAP, e1RM line, missing-1RM dialog, rest day, effort scale input, "Use as new 1RM" | sonnet | ⬜ |
| 4b | 4 | Plan editor and plan screen: program blocks, percent editor, fidelity warnings, periodization table | sonnet | ⬜ |
| 4c | 4 | Programs: list, detail, start wizard; import preview additions | sonnet | ⬜ |
| 4d | 4 | 1RMs screens, 1RM calculator, Settings "Strength" section, onboarding focus and lifts steps, More and sidebar entries | sonnet | ⬜ |
| 4e | 4 | Progress Strength tab, Home (program week, rest day, missing 1RMs), cycle report "Programs and 1RMs", history prescribed vs actual | sonnet | ⬜ |
| 5 | 5 | Integration: E2E v4 flow, audits, docs (IMPORT_FORMAT, schema, AI prompts, BACKUP_FORMAT, README), screenshots, version 4.0.0 | sonnet | ⬜ |
| 6 | — | Final review, PR, CI, APK on the PR, merge, release check | orchestrator | ⬜ |

Legend: ⬜ pending · 🟨 in progress · ✅ done · ⚠️ done with a recorded gap.

---

## Wave 1 — pure domain and data (parallel)

### 1a — e1RM and effort · haiku
Owns: `src/domain/e1rm.ts`, `rts-table.ts`, `effort.ts` (+ tests); `metrics.ts` and `stats.ts` (formula
parameter, default `epley`, so every existing caller and test is unchanged); the RIR rule of
`workout.ts` (`validateSet`: 0–10 in steps of 0.5).
SPEC-v4 §3. The RTS chart comes from `git show 3774916:src/domain/e1rm/rts-table.ts` with its source
text. Every example of §3.1 is a test; `strengthE1rm` (§3.2).

### 1b — Reference 1RM, schemes, prescriptions, strength · sonnet
Owns (new files only): `src/domain/reference-max.ts`, `percent-scheme.ts`, `prescription.ts`,
`strength.ts` (+ tests). Imports the shared types of `scheme-set.ts`.
SPEC-v4 §2, §5.1 (scheme validation, `programWeekFor`, scheme week resolution, `withPercentSummary`
on a structural type), §6 (calculation, rounding mode, deload transform, tonnage, comparison) and §8
(`strength.ts` works on estimates passed in, so it does not depend on 1a). Every example is a test.

### 1c — Programs · sonnet
Owns: `src/domain/program.ts` (+ test), `src/library/programs/**`, the exercises added to
`src/library/exercises/**` (and their data tests), `src/library/index.ts` export line.
SPEC-v4 §4: schema with roles, `validateProgram`, `resolveParams`/`validateParams`,
`expandProgramDay`, the eight v1 templates moved without changing a number (snapshot test built from
the v1 files), variation and accessory mapping to library exercises with the mapping table recorded
for `docs/DECISIONS.md` (returned in the report; the orchestrator appends it).

## Wave 2 (parallel)

### 2a — Plan model, import/export · sonnet
Owns: `src/domain/plan.ts`, `workout.ts` (prescription snapshot rules), `workout-builder.ts`,
`plan-import.ts`, `plan-export.ts`, `program-plan.ts` (new: `expandWorkout`, `programToPlan`,
`advanceProgramBlocks`, `hasNextBlock`, `fidelityWarnings`), `src/library/plan-templates/**` (hybrid
template), `src/library/ai-prompt.ts`, `ai-review-prompt.ts` (percent rule and 1RM summary line; the
orchestrator updates the documents the templates are pinned to in the same wave).
SPEC-v4 §5, §6.3 wiring, §7 (builder), §9.

### 2b — Persistence, backup, CSV · sonnet
Owns: `src/data/**`, `src/domain/backup.ts`, `src/domain/logbook-csv.ts`.
SPEC-v4 §11.1, §11.2: migration `012` with real-SQLite tests (including the v1 carry-over from a
database that holds v1 rows), `ReferenceMaxRepository` with contract tests, new settings, round trips
of the new plan/workout fields and half-point RIR, backup export/restore with id remapping, CSV
columns.

## Stage 3 — State store · sonnet
Owns: `src/state/**`, `src/test-utils/**`.
Reference-max actions; settings; one memoized selector for the effective workout and prescriptions of
any plan week (logger, plan screen and periodization table read it); workout start with prescription
snapshots; tick-to-confirm reps; missing-1RM completion on the active workout; rest-day completion;
`advanceProgramBlocks`; program start (`programToPlan` + 1RMs + activation); strength selectors;
summary data (session e1RM, deltas, prescribed vs actual, new-1RM offer); cycle-report additions;
formula threading into the existing chart/record selectors; import with `referenceMaxes`.

## Wave 4 — UI (parallel)

Each stage owns its component folders, routes and namespaces; screens talk only to the store.

- **4a — Logger · sonnet.** `src/components/workout/**`, the shared `SetRow` and effort input;
  namespace `workout`. SPEC-v4 §3.3, §7.
- **4b — Plan screens · sonnet.** `src/components/plan/**`, route `plans/[id]/periodization`;
  namespaces `plan`, `planEditor`. SPEC-v4 §10.3, §10.4.
- **4c — Programs and import preview · sonnet.** `src/components/programs/**`, routes `programs/**`,
  `src/components/plan-import/**`, the "New plan" entry; namespaces `programs`, `planImport`.
  SPEC-v4 §9, §10.2.
- **4d — 1RMs, calculator, settings, onboarding · sonnet.** `src/components/maxes/**`, routes
  `maxes/**`, `tools/one-rep-max`, `src/components/settings/**`, `src/components/onboarding/**`,
  More and sidebar entries; namespaces `maxes`, `settings`, `onboarding`. SPEC-v4 §10.1, §10.5, §10.6.
- **4e — Progress, Home, report, history · sonnet.** `src/components/progress/**`, `home/**`,
  `cycle-report/**`, `history/**`; namespaces `strength`, `progress`, `home`, `cycleReport`,
  `history`. SPEC-v4 §8, §10.7.

## Stage 5 — Integration · sonnet
E2E test of SPEC-v4 §12 (and the v2 and v3 flows still pass); cross-feature audit (both journeys in
both locales, accessibility, general-focus profile sees no strength surface); documents
(`IMPORT_FORMAT.md`, `cycle-plan.schema.json`, regenerated AI prompt docs, `BACKUP_FORMAT.md`, README
with a "Strength training and programs" section, layer READMEs); screenshots; version `4.0.0`.

## Stage 6 — Final review and release · orchestrator
Full review against SPEC-v4, PR to `main`, CI green, APK built on the PR, squash merge, `Android APK`
run on `main` and `latest-main` pre-release verified.
