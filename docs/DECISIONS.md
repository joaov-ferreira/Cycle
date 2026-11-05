# CYCLE — Decisions Log

Record of architecture and data-source decisions. Each entry: date, stage, decision,
alternatives considered, rationale. Append only; never rewrite past entries.

## 2026-11-05 — Planning

- Spec and plan defined in `docs/SPEC.md` and `docs/PLAN.md`.
- Project language is English (code, docs, commits, PRs). The app UI is bilingual:
  English (`en`, source catalog) and Brazilian Portuguese (`pt-BR`); default from device
  locale via `expo-localization`, overridable in Settings.
- Local persistence with `expo-sqlite`, behind repository interfaces.
- Testing with `jest-expo` + `@testing-library/react-native`; TDD mandatory (AGENTS.md).
- Default e1RM formula: Tuchscherer (RTS) RPE chart; alternatives: RIR-adjusted Epley and Brzycki.
- Smolov, Smolov Jr. and Sheiko values will be transcribed from identified sources in stages 6–8, never invented.

## 2026-11-05 — Orchestration

- GitHub PR tooling is not used in this environment (owner instruction). Every stage is
  landed with the direct-to-`main` squash fallback from AGENTS.md (Git & PR workflow,
  step 8): sub-agents work on the stage branch locally, the orchestrator reviews, squashes
  it onto `main`, runs the checks on `main` and pushes. No PRs are opened.

## 2026-11-05 — Stage 1: Foundation

Sources consulted: Expo SDK 58 docs (fetched as Markdown on 2026-11-05) for
`expo-sqlite` (`/versions/v58.0.0/sdk/sqlite`), `expo-localization`
(`/versions/v58.0.0/sdk/localization`), unit testing with `jest-expo`
(`/develop/unit-testing`), JavaScript tabs and custom tabs (`/router/advanced/tabs`,
`/router/advanced/custom-tabs`) and ESLint (`/guides/using-eslint`). The SQLite page's
Metro snippet did not come through in the Markdown/HTML export, so the web setup follows
the reference shipped with the installed package
(`node_modules/expo-sqlite/skills/expo-sqlite/references/web-and-config.md`).

- **Tooling.** `jest-expo` 58 + `jest` 30 + `@testing-library/react-native` 14 (its
  `render`/`fireEvent` are async and must be awaited). ESLint 9 + `eslint-config-expo`
  flat config, set up with `npx expo lint`; this fixed the Stage 0 lint crash (ESLint
  was not installed). The template example code (screens, components, hooks,
  `global.css`, assets, `reset-project` script) was removed, which fixed the Stage 0
  typecheck failure. TypeScript 6 no longer includes `@types/*` automatically, so
  `tsconfig.json` lists `"types": ["jest"]`.
- **Coverage thresholds.** `jest.config.js` enforces ≥ 80% lines globally and ≥ 95% for
  `src/domain/` and `src/programs/`. Jest fails a path threshold that matches no file,
  so a layer's threshold is added automatically once the folder contains source code.
  `src/programs/` has none yet, so only its README exists.
- **State library: zustand** (v5, vanilla `createStore` + `useStore` through a React
  context). Alternatives: React context with `useReducer` only (re-renders every consumer
  and has no selector memoization, while SPEC §12.5 needs derived, memoized data), or
  Redux Toolkit (heavier than this app needs). Zustand is small, works with React 19 and
  the React Compiler, and supports selectors. Stores are created per app run with
  injected repositories (`createAppStore(repos)`). No module singletons, so each test
  gets a fresh store over in-memory repositories.
- **Persistence and DB testing strategy.** The data layer depends on `SqlDatabase`, a
  minimal interface that expo-sqlite's `SQLiteDatabase` satisfies structurally.
  Repositories have an in-memory implementation and a SQLite implementation, and
  **one contract suite** (`repositories.contract.ts`) runs against both. In Jest, SQLite
  runs on Node's built-in `node:sqlite` (Node ≥ 22.13) through a test-only adapter, so
  the real SQL (migrations, constraints, foreign keys) is exercised without native
  modules. The alternative, `better-sqlite3`, would add a native dev dependency. Using
  only fakes would leave the SQL untested. Migrations live in
  `src/data/migrations/NNN_*.ts`, versioned with `PRAGMA user_version`, one transaction
  per migration, and are idempotent. The app refuses a database newer than its code.
- **Schema `001_init`.** `profiles(id, name, created_at)` and a typed per-profile
  `settings(profile_id PK/FK ON DELETE CASCADE, language CHECK IN ('system','en','pt-BR')
  DEFAULT 'system', theme CHECK IN ('dark','light') DEFAULT 'dark')`. Typed columns,
  rather than a key/value table, keep the stored values constrained, and later stages
  add columns through new migrations. The default profile is created on first boot and
  named in the device language ("Default" / "Padrão"). Until the Stage 2 profile
  selector exists, the active profile is the oldest one.
- **Web.** expo-sqlite on web uses its WebAssembly build. `metro.config.js` adds `wasm`
  to the asset extensions and sends the COEP `credentialless` and COOP `same-origin`
  headers in development. The same headers are set in the `expo-router` plugin for
  hosting. `web.output` changed from `server` to `single`: the app is local-first
  (all data is in the browser), and server rendering produced hydration mismatches,
  because the server renders in its own locale while the client uses the browser
  locale. Verified with `npx expo start --web` in headless Chrome:
  `crossOriginIsolated === true`, the database opened, the 5 tabs rendered, and a
  `pt-BR` browser showed the Portuguese UI.
- **Web/desktop layout.** One Expo Router JS `Tabs` navigator for every platform. At
  window widths ≥ 900 px (`layout.wideBreakpoint`), `tabBarPosition: 'left'` with a
  custom `Sidebar` tab bar (brand, icon and label rows, accent marker on the active
  item). Below that, the standard bottom tab bar is used. This keeps a single route
  tree, so tabs and sidebar cannot drift apart. The sidebar sections SPEC §11 lists
  for desktop beyond the five tabs (Programs, Calendar, History, Settings) are added
  when those screens exist (Stage 14 audits the layout). Icons are `expo-symbols`
  (SF Symbols on iOS, Material Symbols on Android/web).
- **i18n approach.** In-house, no library: `src/i18n/` with an `en` source catalog and a
  `pt-BR` catalog typed against it (a missing key is a type error), plus a runtime
  parity test (keys, empty messages, `{{placeholder}}` sets). `t(key, params)` resolves
  dotted keys, typed as the union of catalog leaf paths. Plural rules are hand-coded
  from CLDR (en: `1` → one; pt: integer part 0–1 → one) instead of
  `Intl.PluralRules`, so behavior does not depend on the JS engine. Number and date
  formatting uses `Intl.NumberFormat` / `Intl.DateTimeFormat`. `formatKg` puts a
  non-breaking space before `kg` and shows 1–2 decimals by default
  (`96.25 kg` / `96,25 kg`, `75,0 kg`). Locale resolution: `pt*` → `pt-BR`, otherwise
  `en`. The persisted setting `system | en | pt-BR` overrides the device locale and
  applies instantly through `I18nProvider`.
- **Numeric input.** `normalizeDecimalInput` (i18n) turns typed text into a canonical
  decimal string. It accepts the locale separator, plus `.` in pt-BR, and rejects
  grouping separators and exponents. `validateDecimal` (domain) checks required, range
  (inclusive or exclusive minimum), maximum and decimal places, and returns error
  codes. `NumberInput` shows the localized messages.
- **Theme.** Tokens live in `src/constants/theme.ts`. The dark palette is the one in
  SPEC §11. A light palette was added (not specified in SPEC). The danger color is a
  light red (`#FF6B6B` on dark), because the accent red is reserved for primary
  actions and selection. A test checks that both palettes meet WCAG AA (≥ 4.5:1) for
  every text/background pair. The tab bar marks the active tab with the text color
  plus a raised background, not with red text: `#D32F2F` on the dark surfaces is
  below 4.5:1.

## 2026-11-05 — Stage 2: Profile + reference 1RM

- **Append-only history.** Table `reference_1rm_history(id, profile_id, lift, value REAL,
  effective_at, origin)` with CHECKs on lift, origin and `0 < value <= 600`, and an index on
  `(profile_id, lift, effective_at DESC, id DESC)`. The repository has no update or
  delete. "Current" is the latest by effective date; ties go to the latest insertion
  (highest id). `effective_at` defaults to the repository clock and may be supplied
  (backdated entries do not displace a newer value). Values are validated in the domain
  (`validateReferenceOneRm`) by both repository implementations and by the store before
  anything is written; the DB CHECK is a backstop. Kilograms are stored as REAL: the
  input rule (2 decimals, <= 600) keeps them exactly representable for display.
- **Active profile.** Persisted in a single-row table `app_state(id CHECK = 1,
  active_profile_id REFERENCES profiles ON DELETE SET NULL)` (migration 003), exposed as
  `profiles.getActiveId/setActiveId`. `ensureDefaultProfile` uses the remembered profile,
  else the oldest, else creates one. Alternative considered: a column on `settings`
  (per-profile, so unable to say which profile is active).
- **Onboarding flag.** `settings.onboarding_completed` (migration 003) is per profile, so a
  new profile also gets the first-run 1RM screen. Skipping records nothing and sets the
  flag; empty lifts in onboarding or Settings are simply not recorded (a stored value
  cannot be cleared, consistent with append-only). Saving a value equal to the current one
  adds no record. Onboarding is rendered by `OnboardingGate` around the root stack instead
  of a route, so no navigation redirects are needed.
- **Store.** `profiles`, `oneRmHistory` (all lifts, newest first) and the active profile's
  data are loaded together on init and on switch, so state never mixes two profiles.
  `saveReferenceOneRms` validates every value before writing any. Profile name errors
  (`required`, `tooLong` at 40 characters after trimming) are domain codes surfaced as
  `InvalidProfileNameError`; the UI maps them to localized messages.
- **Settings is a stack route** (`/settings`, opened from More), not a sixth tab, keeping
  SPEC §11's five-tab navigation. Its sections live in `src/components/settings/`; the
  route file only wraps `SettingsScreen`. The sidebar entry for Settings is part of the
  Stage 14 navigation audit.
- **Language selector** reuses the Stage 1 `language` setting through the store; it applies
  instantly because the locale is derived from the persisted setting.

## 2026-11-05 — Stage 3: Increments and rounding

- **Integer micrograms.** `roundLoad` converts kilograms to integer micrograms (10⁻⁶ kg) and
  decides on integers only: `remainder = load % step`, a tie is `2·remainder = step`. Ties,
  exact multiples and `0.1 + 0.2`-style inputs are therefore exact for values with up to six
  decimals. The PLAN suggested grams or rounding to 3 decimals. Grams can misjudge a tie
  when the exact load has sub-gram digits (96.2504 is nearer 97.5 than 95.0, but grams would
  call it a tie). Micrograms keep the decision exact, and a decimal library would be an extra
  dependency.
- **Invalid arguments throw, invalid user input returns codes.** `roundLoad` throws a
  `RangeError` for a negative, non-finite or non-positive argument (programming errors; the
  result is never negative). User input goes through `validateIncrement` first, which returns
  `NumberValidationError` codes (`belowMin`, `aboveMax`, `tooManyDecimals`,
  `notMultipleOfStep`, `invalidNumber`). Repositories also validate and throw
  `InvalidIncrementError(reason)`, as the 1RM history does.
- **Step rule.** `NumberRules` gains an optional `step`: a value must be a multiple of the step,
  counted from zero. It is checked on scaled integers, after range and decimal checks. It is
  generic, so `NumberInput` shows the localized message without knowing about increments.
- **Storage.** Migration `004_rounding` adds `rounding_settings` (increment and mode per
  profile) and `lift_increment_overrides`. The alternative was columns on `settings`. A
  separate table keeps the `Settings` contract, the profile creation and the 001 schema test
  unchanged. A profile without a `rounding_settings` row uses the defaults (2.5 kg, nearest),
  so no row has to be created when a profile is.
- **Scope of overrides.** A per-lift override replaces only the increment. The rounding mode
  is profile-wide, as SPEC §5 states ("profile-wide setting, optional per-lift override").
- **Presets and custom.** The presets are `1, 1.25, 1.5, 2, 2.5` kg. The custom option opens
  a field with the locale's decimal separator (0.1–25 kg, 0.05 steps). An invalid custom value
  is not stored, and the stored value stays in effect until the user enters a valid one.
  Per-lift choice is a two-segment control (Use default / Own), so the preset row is never
  repeated across seven segments on a phone.
- **Example.** The preview shows the SPEC §5 example (96.25 kg) with the current default
  increment and mode, formatted by the locale (`96.25 kg → 95.0 kg`, `96,25 kg → 95,0 kg`).
- **Naming.** The option that follows the profile default is labelled "Use default" (pt-BR
  "Usar padrão"), not "Default", so it does not collide with the profile button of the same
  name in Settings.

## 2026-11-05 — Stage 4: Program database + custom 5/3/1

- **Schema additions to SPEC §3.2.** `SetPrescription.percentParam` links a set to a `fraction`
  parameter (its `percent` must equal the parameter default, checked by the validator), so the
  template stays self-describing and `resolveTemplate` can apply the athlete's values.
  `ParamRef` is `{ param: string }` and is used by `addKg` (unit `kg`). `ConfigurableParam` is
  `{ id, label, unit: 'fraction' | 'kg', min, max, step?, default, source }`.
- **5/3/1 representation.** One `main` item per week with `lift: 'selected'` and a single set
  entry with `repeat: 3` (the 6×6 idiom of the schema); `totalSets` expands it. The three
  percentages are the parameters `week1Percent`, `week2Percent`, `week3Percent`
  (30–105 %, step 0.5 %, defaults 75/85/95 %). Source: the user's definition, `docs/SPEC.md`
  §3.3-A, accessed 2026-11-05, with a note that it is not Wendler's 5/3/1.
- **Validator rules beyond the SPEC list.** Contiguous week and day numbering, `daysPerWeek`
  days in every week, `liftSelectable` iff more than one allowed lift, lift of each main item
  allowed by the template, a set without percent must be `unverified` with a note, and a
  `verified` template may not contain unverified sets. Percentages are limited to (0, 150 %].
- **Block rules.** `getBlock` accepts a start week from 1 to `durationWeeks` and returns the
  existing weeks only (partial block at the end), throwing `RangeError` otherwise.
  `maxBlockStartWeek` (`durationWeeks - 2`, at least 1) is what the generator UI offers
  (SPEC §4.1).
- **Parameter storage.** Table `program_params(profile_id, template_id, param_id, value)`
  (migration 005), generic so Smolov Jr. increments reuse it. The range is per template, so the
  repository only requires a finite number and the store validates with `validateParamValue`
  (error codes `belowMin`, `aboveMax`, `notMultipleOfStep`, `invalidNumber`, `unknownParam` in
  `InvalidProgramParamError`). A stored value that is no longer valid falls back to the default.
  The data layer therefore does not import `src/programs/`.
- **Exact steps.** Parameter steps are checked on micro-units, so `0.755` is on the 0.5 % step and
  floating-point noise (`0.1 + 0.2`) cannot reject a valid value. The UI edits percentages
  (75.5) and converts to fractions (0.755) with integer rounding.
- **Programs routes.** `/programs` (list) and `/programs/[id]` (detail) are stack routes opened
  from More, like Settings; screens live in `src/components/programs/`. The list shows
  version, source, duration, frequency and a verification badge; the detail also shows the
  accessed date and notes, the percentage editor and the full structure. Template names,
  versions and source texts are stored in English (SPEC §3.1 rule 8) and are not translated;
  labels around them are. Unverified sets show "—" instead of a percentage plus their note and
  an "Unverified data" badge, and no load is ever shown in this screen.
