# `src/state/` — stores and hooks

Connects persistence (`src/data/`) and the math engine (`src/domain/`) to the UI.

- `app-store.ts` — the app store (zustand, vanilla `createStore`), created per app run
  with the `Repositories` to use. Holds the active profile and its settings; actions
  persist through the repositories before updating state.
- `app-store-context.tsx` — `AppStoreProvider` and `useAppStore(selector)`.
- Derived data is exposed through selectors (`select*`), so screens never recompute it
  by hand (SPEC §12.5).

Dependency rules:

- May import `src/domain/`, `src/programs/`, `src/data/` and `src/i18n/`.
- Must not import `src/components/` or `src/app/`.
- No module-level store singletons: tests create a store over in-memory repositories.
