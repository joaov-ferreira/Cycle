# `src/app/` — Expo Router routes

Every `.tsx` file here is a screen and every `_layout.tsx` a navigator. Keep only routes and layouts here:
each route file renders one screen component from `src/components/<feature>/` and wires its callbacks to the
router, so components never import the router themselves.

- `_layout.tsx` — root: `AppProviders` (SQLite repositories, store, locale, theme; the rest notifier and the
  app version come from `src/platform/`), `KeepAwakeWhileLogging`, `OnboardingGate` +
  `OnboardingNavigation`, `AppShell` (sidebar at ≥ 900 px) and a stack.
- `(tabs)/_layout.tsx` — the bottom tabs (`navigation/app-tabs.tsx`).
- `(tabs)/index|plan|workout|progress|more.tsx` — Home, Plan, Workout, Progress (accepts `?exerciseId=`) and
  More (links to Exercises, History, Body, Programs, 1RMs, the calculator and Settings).
- `plans/index|new|templates|import.tsx`, `plans/[id]/index|edit|export.tsx` — plan list, new plan, template
  gallery, import (`?update=<planId>` preselects "Update plan"), detail, editor and export.
  `/plans/scratch/edit` (the literal id `scratch`) creates a plan.
- `plans/[id]/periodization.tsx` — the periodization table (v4).
- `programs/index.tsx`, `programs/[id]/index|start.tsx` — strength program library, a program and its start
  wizard; `maxes/index.tsx`, `maxes/[exerciseId].tsx` — reference 1RMs and one exercise's history;
  `tools/one-rep-max.tsx` — the 1RM calculator. These routes go back to their parent when opened
  directly (`navigation/use-go-back.ts`).
- `plans/[id]/review.tsx` — Review with AI; `plans/[id]/cycles/[cycle].tsx` — the report of one cycle.
- `body.tsx` — body tracking (reached from More and the sidebar).
- `exercises/index|new.tsx`, `exercises/[id].tsx` — library, new exercise, detail.
- `history/index.tsx`, `history/[id].tsx` — history list and workout detail.
- `settings.tsx` — Settings (profile, experience, workout tools, data/backup, theme, language).
