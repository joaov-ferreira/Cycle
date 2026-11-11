# `src/state/` — stores and hooks

Connects persistence (`src/data/`) and the pure logic (`src/domain/`, `src/library/`) to the UI.

- `app-store.ts` — entry point: `createAppStore(repos, { now?, notifier?, appVersion? })` (zustand,
  vanilla `createStore`), created per app run. `now` is the injectable clock used for every
  timestamp; `notifier` the rest-end notification port (`RestNotifier`, used only while
  `settings.restNotifications` is on, failures swallowed); `appVersion` goes into backups
  (default `'0.0.0'`). Boot, settings and profiles live here; everything else is split into
  `slices/` (`exercises`, `plans`, `workouts`, `settings` (tools settings and exercise settings),
  `rest` (the timer; it never ticks, remaining time comes from the clock), `body`, `backup`,
  `reference-maxes`).
- `types.ts` — `AppState` (state + actions), `AppStore`, `FinishResult`, `StoreContext`.
- `errors.ts` — typed errors carrying domain codes (`PlanValidationError { issues }`,
  `CustomExerciseValidationError { errors }`, `WorkoutValidationError`, `WorkoutInProgressError`, …).
- `selectors.ts` — pure selectors; those that derive collections are memoized (`memo.ts`).
- `selectors-v3.ts` — v3 selectors: rest remaining, workout layout, similar exercises, cycle
  numbers/reports, AI review input/prompt, body series/stats, backup reminder, insights.
- `selectors-v4.ts` — v4 (strength mode) selectors built on the effective-workout core that lives in
  `selectors.ts` (see below).
- `index.ts` — public surface: store factory, provider/hook, errors, selectors, types.
- `app-store-context.tsx` — `AppStoreProvider` and `useAppStore(selector)`.

Rules:

- All data is scoped to the active profile and reloaded on `init` / `switchProfile`.
- Actions persist through the repositories, then update state. Plan, exercise and workout input is
  validated with the domain validators; failures throw typed errors with codes, never strings.
- The in-progress workout is saved after every edit. Writes are serialized (`enqueue`), so a slow
  save can never overwrite a newer one; the in-memory draft updates immediately.
- Derived data is exposed through selectors (`select*`), so screens never recompute it by hand.

Dependency rules:

- May import `src/domain/`, `src/library/`, `src/data/` and `src/i18n/`.
- Must not import `src/components/` or `src/app/`.
- No module-level store singletons: tests create a store over in-memory repositories
  (`src/test-utils/seed.ts`: `createTestStore`, `seedPlan`, `seedCompletedWorkout`, and for v3
  `v3PlanContent`, `createFakeNotifier`, `seedBodyMetrics`, `seedCompletedCycle`).
- The persistent exercise note is `setExerciseSettingsNote(exerciseId, note)`; `setExerciseNote`
  keeps editing the note of an exercise inside the workout in progress.
- Transient state is not persisted: `restTimer` (it never ticks; the remaining time is computed from the
  clock), `lastFinish` and `completedCycle` (the "Cycle complete" notice of Home exists only in the run that
  finished the cycle; the cycle report itself is always available from the plan). `init` and
  `switchProfile` reset them. `src/e2e/spec-flow-v3.test.tsx` shows the store driven through the real routes.

## v4 — strength mode (SPEC-v4)

State: `referenceMaxes: ReferenceMax[]` (all records of the profile, loaded on `init`, profile switch,
backup restore and after a custom exercise is deleted). New settings (`focus`, `e1rmFormula`,
`effortScale`, `roundingMode`) live in `settings`.

Actions:

- 1RMs: `addReferenceMax({ exerciseId, kg, origin?, effectiveAt? })` (validates; after it, the
  workout in progress gets the loads of prescribed exercises that lacked this 1RM), `deleteReferenceMax(id)`,
  `useEstimateAsMax(exerciseId, kg)` (origin `fromE1rm`).
- Settings (optimistic, rolled back on failure): `setFocus`, `setE1rmFormula`, `setEffortScale`,
  `setRoundingMode`. `completeOnboarding({ focus?, maxes? })` (maxes saved with origin `onboarding`).
- Programs and plans: `startProgram({ programId, name, roles, params?, accessories, maxes?, maxOrigin?, locale? })`
  → plan id, `advanceProgramBlocks(planId)`, `completeRestDay(planId)`. Plan actions validate with the
  program library, write the percent summary and `importPlan` / `updatePlanFromImport` save the
  document's 1RMs (origin `import`) only for exercises that have none.
- Logging: `startPlanWorkout` builds from the effective workout (prescription snapshots, effective
  ids); `toggleSetDone` stores the prescribed reps when the reps are empty (not for AMRAP/extra sets).

Selectors:

- Settings and 1RMs (`selectors.ts`): `selectFocus`, `selectE1rmFormula`, `selectEffortScale`,
  `selectRoundingMode`, `selectCurrentMaxes`, `selectMaxHistory(id)`, `selectExercisesWithMax`,
  `selectStrengthVisible`.
- Effective workouts (`selectors.ts`): `selectEffectiveWorkout(planId, workoutIndex, at?)` is the one
  memoized core (workout of the week, prescriptions, suggestions). `selectNextPlanWorkout`,
  `selectHomeSummary().nextWorkout`, `selectSuggestions`, `selectWorkoutSuggestions` and
  `selectPlanExerciseIds` all go through it, so plans without v4 content behave as before.
  `selectNextPlanWorkout` returns the plan workout with the week's exercises plus `isRestDay`, `notes`
  and `prescriptions`.
- Plan screens (`selectors-v4.ts`): `selectPeriodization`, `selectFidelityWarnings`, `selectMissingMaxes`,
  `selectHasNextBlock`, `selectPlanBasisIds`, `selectPlanExportText`, `selectParsedPlanImport`,
  `selectImportMaxesPreview`.
- Strength: `selectStrengthEstimates(id)`, `selectLatestStrengthEstimate(id)`,
  `selectStrengthCards(period, now)`, `selectStrengthSeries(id, period, now)`,
  `selectSetEstimate(exerciseIndex, setIndex)`, `selectWorkoutStrengthSummary(workoutId)`,
  `selectPrescriptionComparison(workoutId, exerciseIndex)`, `selectCycleStrengthReport(planId, cycleNumber)`.
  `selectAiReviewInput` passes `strength`; chart/record selectors and `finishWorkout` use `settings.e1rmFormula`.

Transient state: none added. Rest-day completion sets `completedCycle` like a finished session does.
Test helpers (`src/test-utils/seed.ts`): `seedReferenceMax`, `seedStrengthProfile`, `v4PlanContent`,
`v1ExamplePlan`, and the ids `SQUAT`, `BENCH`, `DEADLIFT`.
