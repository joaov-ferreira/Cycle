# `src/i18n/` — internationalization

- `locales/en/<namespace>.ts` — the **source** catalog, one file per namespace (`app`, `tabs`,
  `navigation`, `common`, `home`, `plan`, `planImport`, `workout`, `history`, `progress`, `exercises`,
  `picker`, `onboarding`, `settings`, `profile`, `validation`); `locales/en.ts` composes them.
  `locales/pt-BR/<namespace>.ts` mirrors them, each typed against its English namespace
  (`typeof en<Namespace>`), and `locales/pt-BR.ts` composes them typed as `Catalog`, so a missing or
  extra key is a type error; `catalogs.test.ts` also checks the namespace list, key parity, empty
  messages and placeholder parity at runtime. A feature adds its strings to its own namespace files
  (create both files and register them in `en.ts`, `pt-BR.ts` and the namespace list of the test).
- `translate.ts` — `t(key, params)`: `{{name}}` interpolation (numbers are formatted for
  the locale) and plurals (`{ one, other }` selected by `params.count`, CLDR rules for
  en and pt).
- `locale.ts` — `resolveLocale` (`pt*` → `pt-BR`, else `en`), `effectiveLocale`
  (setting `system` | `en` | `pt-BR`).
- `device-locale.ts` — device locale via `expo-localization`.
- `format.ts` — `formatNumber`, `formatKg`, `formatPercent`, `formatDate` (`Intl`).
- `decimal-input.ts` — parse what the user typed (`,` or `.` in pt-BR).
- `I18nProvider.tsx` — `I18nProvider`, `useT()`, `useI18n()`.

Dependency rules: may import nothing from the app's other layers (React and
`expo-localization` only). `src/domain/` and `src/library/` must not import this layer.
