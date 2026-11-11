# CYCLE v3 — Implementation Plan

> Implements [`SPEC-v3.md`](./SPEC-v3.md) ("gym companion") on top of v2
> ([`SPEC.md`](./SPEC.md); the v2 plan is archived in [`archive/PLAN-v2.md`](./archive/PLAN-v2.md)),
> following [`../AGENTS.md`](../AGENTS.md). v2 was merged into `main` in PR #2 (`a47b46a`).

## How this plan works

Same method as v2:

- One integration branch (`claude/bodybuilding-training-app-lr6egj`, restarted from `main` after the
  v2 merge), one PR to `main` at the end, squash merge, APK verified on `main`.
- The orchestrator writes specs and plans, delegates every stage to a clean-context sub-agent,
  reviews (runs `npm test -- --coverage`, `npx expo lint`, `npx tsc --noEmit`, reads the diff against
  the spec) and integrates. No production code by the orchestrator beyond trivial fixes (≤ 10 lines).
- Model policy: the cheapest model that can plausibly do the stage; escalate **haiku → sonnet →
  opus** when a stage fails review after its fix rounds.
- TDD is mandatory; tests use the hand-computed examples of the spec.
- Stages of a wave run in parallel, each in its own git worktree, touching only the paths under
  "Owns"; they never edit `README.md`, `docs/*`, `AGENTS.md` or `package.json` unless the stage says
  so. The "Owns" lists below name the v2 folders they extend; the orchestrator confirms them against
  the merged v2 code at kick-off and adjusts the stage prompts, not the scope.
- New UI strings go in the stage's own catalog namespaces, in both locales.

### Kick-off (done)

The integration branch continues from `main` after the v2 merge; the v2 plan moved to
`docs/archive/PLAN-v2.md` and this file became `docs/PLAN.md`; `docs/SPEC-v3.md` is listed in
AGENTS.md as the extension of `docs/SPEC.md`.

### Status

| Stage | Wave | Scope | Model | Status |
|---|---|---|---|---|
| 0 | — | Spec v3, plan v3 | orchestrator | ✅ |
| 1a | 1 | Gym tools domain: rest timer, plates, warm-ups, similar exercises | haiku | ✅ |
| 1b | 1 | Supersets and drop sets: model, validation, metrics, import/export | sonnet | ✅ |
| 1c | 1 | Insights: calendar, streak, weekly trends | haiku | ✅ |
| 1d | 1 | Backup document, restore mapping, CSV | sonnet | ✅ |
| 1e | 1 | Body metrics domain | haiku | ✅ |
| 1f | 1 | AI review prompt builder | haiku | ✅ |
| 2a | 2 | RIR ramp and cycle report | sonnet | ✅ |
| 2b | 2 | Persistence: migration 011, repositories, bulk export/import | sonnet | ✅ |
| 3 | 3 | State store: timer, tools settings, supersets, ramp, reports, backup, body, insights | sonnet | ✅ |
| 4a | 4 | Logger: rest timer bar, notifications, keep-awake, plates, warm-ups, notes | sonnet | ⬜ |
| 4b | 4 | Logger and plan editor: supersets, drop sets, similar exercises, repeat workout | sonnet | ⬜ |
| 4c | 4 | Cycle: RIR ramp settings, timeline, report screen, cycle history, Review with AI, update in place | sonnet | ⬜ |
| 4d | 4 | Settings → Data: backup, restore, CSV, reminder | sonnet | ⬜ |
| 4e | 4 | Body screen | haiku | ⬜ |
| 4f | 4 | Progress: Volume and Calendar tabs, streak on Home, share summary, how-to link | haiku | ⬜ |
| 5 | 5 | Integration: E2E v3 flow, audits, docs (IMPORT_FORMAT, BACKUP_FORMAT, README), screenshots | sonnet | ⬜ |
| 6 | — | Final review, PR, CI, APK on the PR, merge, release check | orchestrator | ⬜ |

Legend: ⬜ pending · 🟨 in progress · ✅ done · ⚠️ done with a recorded gap.

---

## Wave 1 — pure domain (parallel)

### 1a — Gym tools · haiku
Owns: `src/domain/rest-timer.ts`, `plates.ts`, `warmup.ts`, `exercise-similar.ts` (+ tests).
SPEC-v3 §1.1, §2, §3, §11 (similar exercises). Every row of the example tables is a test.

### 1b — Supersets and drop sets · sonnet
Owns: `src/domain/plan.ts`, `plan-import.ts`, `plan-export.ts`, `workout.ts`, `metrics.ts`,
`workout-builder.ts`, `stats.ts` (only the changes below).
SPEC-v3 §4: `PlanExercise.supersetGroup`, validation codes, `supersetGroups()` helper, JSON
`superset` and the text `+` line, export, `WorkoutExercise.supersetGroup` snapshot in the builder;
`LoggedSet.kind` `'drop'`, `dropWithoutWorkingSet`, drop-set default load, volume includes drop sets
and nothing else does (regression tests proving counted-set metrics are unchanged). Also adds the
type field `ExerciseSession.targetRir: number | null` (SPEC-v3 §5) so wave 2 stages share it.

### 1c — Insights · haiku
Owns: `src/domain/insights.ts` (+ test). SPEC-v3 §10 with the streak example.

### 1d — Backup and CSV · sonnet
Owns: `src/domain/backup.ts`, `src/domain/logbook-csv.ts` (+ tests).
SPEC-v3 §8: document types, `buildBackup`, `parseBackup` (codes), the id-remapping plan for restore
(`planRestore(backup)` → records to insert with placeholder references), round-trip test, RFC 4180
CSV with quoting cases.

### 1e — Body metrics · haiku
Owns: `src/domain/body.ts` (+ test). SPEC-v3 §9 with the worked example.

### 1f — AI review prompt · haiku
Owns: `src/library/ai-review-prompt.ts` (+ test), extraction of the shared OUTPUT / RULES / EXERCISE
LIST blocks of `src/library/ai-prompt.ts` into reusable pieces without changing its output (the
generated prompt docs must stay byte-identical).
SPEC-v3 §7: templates in both locales, the session line format, tests on a small fixture. Its input
is plain data (plan JSON text, sessions per exercise, adherence, stalled ids, weekly sets per
muscle), so it does not depend on stage 2a.

## Wave 2 (parallel)

### 2a — RIR ramp and cycle report · sonnet
Owns: `src/domain/cycle.ts`, `progression.ts`, `cycle-report.ts`, and the `rirRamp` additions to
`plan.ts`, `plan-import.ts`, `plan-export.ts` (after 1b is merged, so there is no overlap).
SPEC-v3 §5 (`weekTargetRir`, ramp validation, the revised "easy" rule using
`ExerciseSession.targetRir`, directive `rir: 3-0`, `cycle.rirRamp`) and §6 (`cycleReport` with the
examples).

### 2b — Persistence · sonnet
Owns: `src/data/**`.
Migration `011` (SPEC-v3 §12) with real-SQLite tests; `BodyMetricRepository`; exercise note and bar
weight in `ExerciseRepository`; new settings fields; superset group, `drop` kind and
`ExerciseSession.targetRir` round trips; `BackupRepository` (`exportProfile(profileId)` → backup
data; `restoreAsNewProfile(backup)` in one transaction with id remapping; contract tests, including
"a failure leaves nothing behind").

## Stage 3 — State store · sonnet
Owns: `src/state/**`, `src/test-utils/**`.
Store slices and selectors for everything above: timer (start on set done, superset rule, adjust,
skip; a `Notifier`/`KeepAwake` port injected so tests use fakes), tools settings, exercise notes,
superset edits, drop sets, week target RIR applied when a workout starts, cycle-completed flag and
reports, AI review prompt selector, plan update in place (archived copy), backup export/restore,
body metrics CRUD, insights selectors.

## Wave 4 — UI (parallel)

Each stage owns its component folder(s), routes and namespaces; screens talk only to the store.

- **4a — Logger tools · sonnet.** `src/components/workout/**` (timer bar, plates sheet, warm-up
  button, exercise note), `src/platform/` adapters for `expo-notifications` and `expo-keep-awake`
  (installed with `npx expo install` after reading the SDK docs; the only stage allowed to edit
  `package.json`/`app.json` for these two modules), Settings rows for rest default / notifications /
  keep screen on / bar and plates. Namespaces `timer`, `tools`. SPEC-v3 §1.2, §2, §3, §11.
- **4b — Supersets, drop sets, substitutions · sonnet.** Superset card and drop-set rows in the
  logger (coordinates with 4a through separate component files), "Link with next" in the plan
  editor, similar exercises in the picker, repeat workout from history. SPEC-v3 §4, §11.
- **4c — Cycle depth and AI review · sonnet.** RIR ramp in cycle settings and timeline, report
  screen (`plans/[id]/cycles/[cycle]`), cycle history, Home "cycle complete" banner, Review with AI
  screen, "Update plan" option in the import preview. Namespaces `cycleReport`, `aiReview`.
  SPEC-v3 §5–§7.
- **4d — Data · sonnet.** Settings → Data: export backup (file + share sheet via `expo-file-system`
  / `expo-sharing`, installed here), restore with summary and confirmation, CSV export, backup
  reminder. Namespace `backup`. SPEC-v3 §8.
- **4e — Body · haiku.** `src/components/body/**`, route `body`, More entry, namespace `body`.
  SPEC-v3 §9.
- **4f — Insights and small aids · haiku.** Progress segmented control with Volume and Calendar,
  bar chart component, streak on Home, share summary, how-to link. Namespace `insights`.
  SPEC-v3 §10, §11.

## Stage 5 — Integration · sonnet
E2E test of SPEC-v3 §13; cross-feature audit (logger with timer + superset + drop sets together,
accessibility, both locales); extend `docs/IMPORT_FORMAT.md` and `cycle-plan.schema.json` with
`superset` and `cycle.rirRamp` (optional properties, same version) and regenerate the AI prompt docs;
write `docs/BACKUP_FORMAT.md`; update README (features, AI review loop, backup) and screenshots; app
version `3.0.0`; coverage thresholds hold.

## Stage 6 — Final review and release · orchestrator
Full review against SPEC-v3, PR to `main`, CI green, APK built on the PR with the `build-apk` label
(new native modules), squash merge, `Android APK` run on `main` and `latest-main` pre-release
verified.
