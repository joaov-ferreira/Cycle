# `src/state/` — stores and hooks

Connects persistence (`src/data/`) and the pure logic (`src/domain/`, `src/library/`) to the UI.

- `app-store.ts` — entry point: `createAppStore(repos, { now?, notifier?, appVersion? })` (zustand,
  vanilla `createStore`), created per app run. `now` is the injectable clock used for every
  timestamp; `notifier` the rest-end notification port (`RestNotifier`, used only while
  `settings.restNotifications` is on, failures swallowed); `appVersion` goes into backups
  (default `'0.0.0'`). Boot, settings and profiles live here; everything else is split into
  `slices/` (`exercises`, `plans`, `workouts`, `settings` (tools settings and exercise settings),
  `rest` (the timer; it never ticks, remaining time comes from the clock), `body`, `backup`).
- `types.ts` — `AppState` (state + actions), `AppStore`, `FinishResult`, `StoreContext`.
- `errors.ts` — typed errors carrying domain codes (`PlanValidationError { issues }`,
  `CustomExerciseValidationError { errors }`, `WorkoutValidationError`, `WorkoutInProgressError`, …).
- `selectors.ts` — pure selectors; those that derive collections are memoized (`memo.ts`).
- `selectors-v3.ts` — v3 selectors: rest remaining, workout layout, similar exercises, cycle
  numbers/reports, AI review input/prompt, body series/stats, backup reminder, insights.
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
