# `src/app/` — Expo Router routes

Every `.tsx` file here is a screen and every `_layout.tsx` a navigator. Keep only routes
and layouts here: components, hooks and utilities live in the other `src/` layers.

- `_layout.tsx` — root: `AppProviders` (SQLite repositories, store, locale, theme),
  `OnboardingGate` (first-run 1RMs) and a stack.
- `(tabs)/_layout.tsx` — main navigation (`src/components/navigation/app-tabs.tsx`).
- `settings.tsx` — Settings route (opened from More); wraps `SettingsScreen`.
- `programs/index.tsx`, `programs/[id].tsx` — Programs list and program detail (opened from More); wrap `ProgramsScreen` and `ProgramDetailScreen`.
- `history/index.tsx`, `history/[id].tsx` — History list and session detail (opened from More); wrap `HistoryScreen` and
  `HistoryDetailScreen`; the `id` is a performed session id.
- `session/[id].tsx` — session detail (opened from the calendar); wraps `SessionDetailScreen`. The `id` is a
  session key `<slotId>-w<blockWeek>` of the live periodization, or `p<periodizationId>-<key>` for a
  session of an activated periodization (where performance is logged).
- `(tabs)/index|periodization|training|progress|more.tsx` — the five tab screens (`progress.tsx` wraps
  `ProgressScreen`; `training.tsx` wraps `TrainingScreen`, which opens `/session/[id]` for logging);
  `periodization.tsx` wraps `PeriodizationScreen` and opens `/programs/[id]` for program settings and `/session/[id]` from the calendar.
