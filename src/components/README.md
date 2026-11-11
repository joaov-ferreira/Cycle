# `src/components/` — UI

One folder per feature; screens read and write only through the store (`src/state/`).

- `ui/` — base components: `Screen`, `Text`, `Card`, `Button`, `NumberInput`, `SegmentedControl`, `TextField`.
- `shared/` — reusable feature-neutral pieces: `ExercisePicker` and `ExerciseSelectModal` (search, filters,
  create a custom exercise), `SetRow`, `Stepper`, `Chip`, `FilterChips`, `ConfirmDialog`, `EmptyState`,
  `CustomExerciseForm`, name/label helpers (`labels.ts`).
- `theme-provider.tsx`, `app-providers.tsx` — theme tokens (`src/constants/theme.ts`) and the boot gate
  (opens persistence, boots the store, provides locale and theme).
- `navigation/` — bottom tabs, `AppShell` + `Sidebar` (wide screens), the More screen.
- `onboarding/` — first-run gate and screen (experience level, then template / import / later).
- `home/` — `HomeScreen`: resume or next-workout card, `CycleSummary` (compact cycle status and deload
  advice), recent workouts.
- `plan/` — Plan tab and plan list/detail, the full `CycleCard` and cycle settings, `cycle-text.ts` (the
  cycle wording shared with Home), and `editor/` (plan editor: compact expandable exercise rows).
- `plan-import/` — new-plan chooser, template gallery, import (paste / file / Create with AI, preview with
  unresolved-exercise resolution) and export.
- `workout/` — start view, logger (exercise cards, suggestions, set rows), summary.
- `history/`, `progress/` (with the in-house `LineChart`), `exercises/`, `settings/` — the other screens.

Rules:

- Every user-facing string comes from `useT()` / `useI18n()`; never hard-code UI text (a test enforces it,
  another rejects catalog keys no code uses).
- Numbers, dates and clock times use the `useI18n()` formatters (`formatKg`, `formatNumber`, `formatDate`,
  `formatTime`, …).
- Colors come from `useTheme()`; touch targets are at least 44 pt (`layout.minTouchTarget`); every control
  has a role and an accessible name (`src/components/a11y-audit.test.tsx` checks every screen).
- May import `src/state/`, `src/i18n/`, `src/domain/`, `src/library/` and `src/constants/`.
- Test behavior with `@testing-library/react-native` and accessible queries (no markup snapshots); screens with
  formatted numbers are tested in `en` and `pt-BR`. Router tests use `src/test-utils/app-routes.tsx`.
