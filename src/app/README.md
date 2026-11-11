# `src/app/` — Expo Router routes

Every `.tsx` file here is a screen and every `_layout.tsx` a navigator. Keep only routes
and layouts here: components, hooks and utilities live in the other `src/` layers. Each route
file only renders a screen component from `src/components/<feature>/`, so a feature stage
replaces the component without touching navigation.

- `_layout.tsx` — root: `AppProviders` (SQLite repositories, store, locale, theme),
  `OnboardingGate` (a pass-through for now) and a stack.
- `(tabs)/_layout.tsx` — main navigation (`src/components/navigation/app-tabs.tsx`).
- `(tabs)/index|plan|workout|progress|more.tsx` — the five tabs: Home, Plan, Workout, Progress, More
  (the More tab lists Exercises, History and Settings).
- `plans/index|new|templates|import.tsx`, `plans/[id]/index.tsx`, `plans/[id]/edit.tsx` — plan list,
  new plan, template gallery, import, plan detail and plan editor.
- `exercises/index|new.tsx`, `exercises/[id].tsx` — exercise library, new exercise, exercise detail.
- `history/index.tsx`, `history/[id].tsx` — workout history and workout detail.
- `settings.tsx` — Settings (profile, theme, language).

All routes of SPEC §12 exist; except Settings and More they are placeholders that show only a
localized title.
