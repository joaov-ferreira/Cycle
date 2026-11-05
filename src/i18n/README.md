# `src/i18n/` — internationalization

- `locales/en.ts` — **source** catalog. `locales/pt-BR.ts` is typed against it
  (`Catalog`), so a missing or extra key is a type error; `catalogs.test.ts` also checks
  key parity, empty messages and placeholder parity at runtime.
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
`expo-localization` only). `src/domain/` and `src/programs/` must not import this layer.
