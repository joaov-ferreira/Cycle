# `src/components/` — reusable UI

- `ui/` — base components: `Screen`, `Text`, `Card`, `Button`, `NumberInput`,
  `SegmentedControl`, `TextField`.
- `theme-provider.tsx` — `ThemeProvider` / `useTheme()` over the tokens in
  `src/constants/theme.ts`.
- `app-providers.tsx` — boot gate: opens persistence, boots the app store, provides
  locale and theme.
- `onboarding/` — `OnboardingGate`, in front of the app (a pass-through until the onboarding stage).
- `settings/` — Settings screen sections: profile, theme, language.
- `home/`, `plan/`, `plan-import/`, `workout/`, `history/`, `progress/`, `exercises/` — one folder per
  feature, holding its screen components. Today they are placeholders that show only a localized
  title; the feature stages replace them.
- `progress/line-chart.tsx` — `LineChart`, the in-house `react-native-svg` chart (a dated value
  series in kg, an optional dashed reference step line, localized axes, tap/hover tooltip, per-point
  accessible buttons) that draws the pure `buildChartModel`.
- `navigation/` — main tabs, `AppShell` (puts the sidebar beside every route at ≥ 900 px), the
  `Sidebar` with the seven SPEC §12 sections and the More tab screen.

Rules:

- Every user-facing string comes from `useT()` (`src/i18n/`); never hard-code UI text.
- Numbers and dates use the `useI18n()` formatters (`formatKg`, `formatNumber`, …).
- Colors come from `useTheme()`; touch targets are ≥ 44 pt (`layout.minTouchTarget`);
  controls have accessible names.
- May import `src/state/`, `src/i18n/`, `src/domain/` and `src/constants/`.
- Test behavior with `@testing-library/react-native` and accessible queries (no markup
  snapshots); screens with formatted numbers are tested in `en` and `pt-BR`.
