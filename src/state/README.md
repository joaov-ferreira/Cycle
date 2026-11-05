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
  `removeSessionSlot`, `moveSessionSlot`, `addMissingProgramDays`; slots are checked against their
  program) and the
  activated periodization (`activatePeriodization(startDate)`, a snapshot in the repository).
  Also the activated sessions (`activeSessions`) and the performed sessions (`performedSessions`):
  `savePerformedDraft` (serialized, so the last edit wins), `completePerformedSession` (validates,
  stores the date and the snapshot, then the session e1RM of each lift with the formula in effect)
  and `loadSnapshotSession`; `amendPerformedSession` edits a completed session and recomputes only its
  e1RM (a new revision, a tombstone, or nothing when the estimate is unchanged). The e1RM history (`e1rmHistory`), `setE1rmFormula` and
  `adoptE1rmAsReference` ("Use as new reference 1RM", origin `from_e1rm`).
- `e1rm-selectors.ts` — `selectE1rmFormula`, `selectSessionE1rms` and `selectPreviousE1rm`.
- `history-selectors.ts` — `selectHistoryEntries` / `selectHistoryEntry`: the completed sessions as pure
  `HistoryEntry` values (record, snapshot data and current e1RMs), newest first.
- `performance-selectors.ts` — `selectTrainingQueue` (sessions in progress and the next pending
  session of the active periodization) and `selectPerformedSession`.
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
