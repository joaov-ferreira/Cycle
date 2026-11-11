# `src/app/` — Expo Router routes

Every `.tsx` file here is a screen and every `_layout.tsx` a navigator. Keep only routes and layouts here:
each route file renders one screen component from `src/components/<feature>/` and wires its callbacks to the
router, so components never import the router themselves.

- `_layout.tsx` — root: `AppProviders` (SQLite repositories, store, locale, theme), `OnboardingGate` +
  `OnboardingNavigation`, `AppShell` (sidebar at ≥ 900 px) and a stack.
- `(tabs)/_layout.tsx` — the bottom tabs (`navigation/app-tabs.tsx`).
- `(tabs)/index|plan|workout|progress|more.tsx` — Home, Plan, Workout, Progress (accepts `?exerciseId=`) and
  More (links to Exercises, History, Settings).
- `plans/index|new|templates|import.tsx`, `plans/[id]/index|edit|export.tsx` — plan list, new plan, template
  gallery, import, detail, editor and export. `/plans/scratch/edit` (the literal id `scratch`) creates a plan.
- `exercises/index|new.tsx`, `exercises/[id].tsx` — library, new exercise, detail.
- `history/index.tsx`, `history/[id].tsx` — history list and workout detail.
- `settings.tsx` — Settings.
