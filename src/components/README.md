# `src/components/` — reusable UI

- `ui/` — base components: `Screen`, `Text`, `Card`, `Button`, `NumberInput`,
  `SegmentedControl`, `TextField`.
- `theme-provider.tsx` — `ThemeProvider` / `useTheme()` over the tokens in
  `src/constants/theme.ts`.
- `app-providers.tsx` — boot gate: opens persistence, boots the app store, provides
  locale and theme.
- `onboarding/` — first-run 1RM gate. `settings/` — Settings screen sections (profiles,
  1RMs and history, increments and rounding, e1RM formula, language). `one-rm/` — the three-lift 1RM form.
  `rounding/` — `IncrementPicker` (presets and custom increment).
- `programs/` — Programs screen (list, Sheiko templates grouped by family), program detail, original-structure view, the
  percentage editor and the kg-increment editor (Smolov Jr.).
- `periodization/` — Periodization screen: session-slot editor (incl. a program family selector with
  a template selector for families such as Sheiko, kg parameters such as the Smolov Jr. weekly
  increment and "Add all days of this program"), warnings, the responsive
  three-week table (weeks side by side at ≥ 900 px, a week toggle on phones), the calendar
  (week × session cards), a Table | Calendar toggle, activation and the session detail screen.
- `performance/` — the performance logger (per-set weight, reps, RIR/RPE, notes; extra sets;
  auto-saved draft; completion and the read-only summary with prescribed vs. actual) and the
  Training screen (sessions in progress and the next pending session).
- `e1rm/` — e1RM display (SPEC §8): the per-set estimate line (valid, low confidence, unverified RTS
  cell), the session estimate card (live while logging, stored once completed) with the comparison
  with the previous e1RM, "Use as new reference 1RM" (with confirmation) and the localized formula
  names. `settings/e1rm-section.tsx` chooses the formula.
- `progress/` — Progress screen (SPEC §9: per-lift cards, period filter) and `LineChart`, the in-house
  `react-native-svg` chart (e1RM line, reference-1RM steps, localized axes, tap/hover tooltip, per-point
  accessible buttons) that draws the pure `buildChartModel`.
- `history/` — History screen (SPEC §10: lift / program / period filters, list items) and the session
  detail (prescribed vs. performed, e1RM, equivalent previous sessions, edit mode built on the logger form).
- `navigation/` — main tabs and the wide-screen sidebar.

Rules:

- Every user-facing string comes from `useT()` (`src/i18n/`); never hard-code UI text.
- Numbers and dates use the `useI18n()` formatters (`formatKg`, `formatNumber`, …).
- Colors come from `useTheme()`; touch targets are ≥ 44 pt (`layout.minTouchTarget`);
  controls have accessible names.
- May import `src/state/`, `src/i18n/`, `src/domain/` and `src/constants/`.
- Test behavior with `@testing-library/react-native` and accessible queries (no markup
  snapshots); screens with formatted numbers are tested in `en` and `pt-BR`.
