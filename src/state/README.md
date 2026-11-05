# `src/state/` — stores and hooks

Connects persistence (`src/data/`) and the math engine (`src/domain/`) to the UI.

- `app-store.ts` — the app store (zustand, vanilla `createStore`), created per app run
  with the `Repositories` to use. Holds the active profile and its settings; actions
  persist through the repositories before updating state.
  Also profiles (create / rename / switch), the active profile's reference 1RM history
  (`saveReferenceOneRms`), the onboarding flag (`completeOnboarding`) and the rounding
  settings (`setIncrementKg`, `setRoundingMode`, `setLiftIncrementKg`) and the program parameters
  (`setProgramParam`, `resetProgramParams`; values are checked against the template's range),
  the session slots (`addSessionSlot`, `updateSessionSlot`, `duplicateSessionSlot`,
  `removeSessionSlot`, `moveSessionSlot`; slots are checked against their program) and the
  activated periodization (`activatePeriodization(startDate)`, a snapshot in the repository).
- `periodization-selectors.ts` — `selectPeriodization` (the live three-week periodization,
  memoized on the slots, 1RM history, rounding settings and program parameters) and
  `selectCurrentOneRms`.
- `app-store-context.tsx` — `AppStoreProvider` and `useAppStore(selector)`.
- Derived data is exposed through selectors (`select*`), so screens never recompute it
  by hand (SPEC §12.5).

Dependency rules:

- May import `src/domain/`, `src/programs/`, `src/data/` and `src/i18n/`.
- Must not import `src/components/` or `src/app/`.
- No module-level store singletons: tests create a store over in-memory repositories.
