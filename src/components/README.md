# `src/components/` — UI

One folder per feature; screens read and write only through the store (`src/state/`).

- `ui/` — base components: `Screen`, `Text`, `Card`, `Button`, `NumberInput`, `SegmentedControl`, `TextField`.
- `shared/` — reusable feature-neutral pieces: `ExercisePicker` and `ExerciseSelectModal` (search, filters,
  create a custom exercise), `SetRow` (half-point effort input, RIR/RPE scale, `% → kg` line, AMRAP / unverified / extra marks, e1RM line), `Tag`, `Stepper`, `Chip`, `FilterChips`, `ConfirmDialog`, `EmptyState`,
  `CustomExerciseForm`, name/label helpers (`labels.ts`).
- `theme-provider.tsx`, `app-providers.tsx` — theme tokens (`src/constants/theme.ts`) and the boot gate
  (opens persistence, boots the store, provides locale and theme).
- `navigation/` — bottom tabs, `AppShell` + `Sidebar` (wide screens), the More screen.
- `onboarding/` — first-run gate and screen (experience level, then template / import / later).
- `home/` — `HomeScreen`: resume or next-workout card, `CycleSummary` (compact cycle status and deload
  advice), the "Cycle complete" and backup-reminder notices, the week streak, recent workouts.
- `plan/` — Plan tab and plan list/detail, the full `CycleCard` and cycle settings, `cycle-text.ts` (the
  cycle wording shared with Home), and `editor/` (plan editor: compact expandable exercise rows).
- `plan-import/` — new-plan chooser, template gallery, import (paste / file / Create with AI, preview with
  unresolved-exercise resolution) and export.
- `workout/` — start view (previews the week's target, or the compact prescription `3×5 @ 75 kg` of percent
  exercises and program blocks, with the program week/day line, the missing-1RM notice and the rest day with
  "Mark rest day as done"), logger (exercise cards with the prescription header — origin, 1RM used, program
  notes, the inline "Set the 1RM" form —, superset cards, set rows with warm-up and drop sets, the rest timer
  bar, plates, notes in the exercise menu), summary (plus the strength part: session e1RM, change, prescribed
  vs actual tonnage and the confirmed "Use as new 1RM"). With `settings.effortScale === 'rpe'` every effort
  label, input and target shows RPE; the stored value stays RIR (`shared/effort.ts`).
- `cycle-report/`, `ai-review/` — the cycle report and Review with AI screens; `plan-import/` also owns the
  "Update plan" choice of the import preview.
- `backup/` — the Settings → Data section (export, restore, CSV); `body/` — body tracking.
- `progress/` (with the in-house `LineChart` and `BarChart`; tabs Exercises, Volume, Calendar), `history/`,
  `exercises/`, `settings/` (profile, experience, workout tools, theme, language) — the other screens.

Rules:

- Every user-facing string comes from `useT()` / `useI18n()`; never hard-code UI text (a test enforces it,
  another rejects catalog keys no code uses).
- Numbers, dates and clock times use the `useI18n()` formatters (`formatKg`, `formatNumber`, `formatDate`,
  `formatTime`, …).
- Colors come from `useTheme()`; touch targets are at least 44 pt (`layout.minTouchTarget`); every control
  has a role and an accessible name (`src/components/a11y-audit.test.tsx` checks every screen, the Volume
  and Calendar tabs and the logger with a superset, a drop set and the rest timer).
- May import `src/state/`, `src/i18n/`, `src/domain/`, `src/library/` and `src/constants/`.
- Test behavior with `@testing-library/react-native` and accessible queries (no markup snapshots); screens with
  formatted numbers are tested in `en` and `pt-BR`. Router tests use `src/test-utils/app-routes.tsx`.
