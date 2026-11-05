# `src/components/` — reusable UI

- `ui/` — base components: `Screen`, `Text`, `Card`, `Button`, `NumberInput`,
  `SegmentedControl`, `TextField`.
- `theme-provider.tsx` — `ThemeProvider` / `useTheme()` over the tokens in
  `src/constants/theme.ts`.
- `app-providers.tsx` — boot gate: opens persistence, boots the app store, provides
  locale and theme.
- `onboarding/` — first-run 1RM gate. `settings/` — Settings screen sections (profiles,
  1RMs and history, language). `one-rm/` — the three-lift 1RM form.
- `navigation/` — main tabs and the wide-screen sidebar.

Rules:

- Every user-facing string comes from `useT()` (`src/i18n/`); never hard-code UI text.
- Numbers and dates use the `useI18n()` formatters (`formatKg`, `formatNumber`, …).
- Colors come from `useTheme()`; touch targets are ≥ 44 pt (`layout.minTouchTarget`);
  controls have accessible names.
- May import `src/state/`, `src/i18n/`, `src/domain/` and `src/constants/`.
- Test behavior with `@testing-library/react-native` and accessible queries (no markup
  snapshots); screens with formatted numbers are tested in `en` and `pt-BR`.
