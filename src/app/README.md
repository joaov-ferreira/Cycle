# `src/app/` — Expo Router routes

Every `.tsx` file here is a screen and every `_layout.tsx` a navigator. Keep only routes
and layouts here: components, hooks and utilities live in the other `src/` layers.

- `_layout.tsx` — root: `AppProviders` (SQLite repositories, store, locale, theme),
  `OnboardingGate` (first-run 1RMs) and a stack.
- `(tabs)/_layout.tsx` — main navigation (`src/components/navigation/app-tabs.tsx`).
- `settings.tsx` — Settings route (opened from More); wraps `SettingsScreen`.
- `programs/index.tsx`, `programs/[id].tsx` — Programs list and program detail (opened from More); wrap `ProgramsScreen` and `ProgramDetailScreen`.
- `(tabs)/index|periodization|training|progress|more.tsx` — the five tab screens.
