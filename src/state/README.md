# `src/state/` — stores and hooks

Connects persistence (`src/data/`) and the pure logic (`src/domain/`, `src/library/`) to the UI.

- `app-store.ts` — entry point: `createAppStore(repos, { now? })` (zustand, vanilla `createStore`),
  created per app run. `now` is the injectable clock used for every timestamp. Boot, settings and
  profiles live here; everything else is split into `slices/` (`exercises`, `plans`, `workouts`).
- `types.ts` — `AppState` (state + actions), `AppStore`, `FinishResult`, `StoreContext`.
- `errors.ts` — typed errors carrying domain codes (`PlanValidationError { issues }`,
  `CustomExerciseValidationError { errors }`, `WorkoutValidationError`, `WorkoutInProgressError`, …).
- `selectors.ts` — pure selectors; those that derive collections are memoized (`memo.ts`).
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
  (`src/test-utils/seed.ts`: `createTestStore`, `seedPlan`, `seedCompletedWorkout`).
