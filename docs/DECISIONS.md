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

## 2026-11-05 — Stage 5: Periodization generator + three-week table

- **Engine signature and placement.** `generatePeriodization(slots, templates, oneRms, rounding,
  params)` lives in `src/domain/periodization.ts`, as SPEC §4.3 and the PLAN require. It imports
  the pure `src/programs/` layer (schema types, `getBlock`, `resolveTemplate`,
  `resolveParamValues`), so `domain/` may now depend on `programs/` for this module (the reverse
  direction already existed for types such as `Lift`; there is no import cycle). Both layers stay
  free of React, Expo, `data/` and `i18n/`.
- **Exact arithmetic.** `exactKg = round(1RM_µg × percent_µ / 10⁶) + addKg_µg`, on integer
  micrograms (the Stage 3 scale), so `100.25 × 0.755 = 75.68875` exactly; `roundLoad` then
  applies the per-lift increment and the mode. Tonnage is summed in micrograms too.
- **`addKg` semantics.** A set's `addKg` is the absolute increment, in kg, added to
  `1RM × percent` for that set (the value of the referenced `kg` parameter: the athlete's
  choice when valid, else the default). The SPEC's "Σ cumulative addKg" is expressed by the data:
  a later week's set references the parameter that holds its total increment. If Smolov Jr.
  needs a multiple of one parameter (e.g. week 3 = 2 × the weekly increment), Stage 7 extends
  `ParamRef`; the engine has a single place to apply it. An `addKg` that cannot be resolved
  produces no load (`unverified`), never a guess.
- **No load without confirmed data.** A set gets `load: 'unverified'` (no exact/rounded kg) when
  it is marked `unverified` (even if it carries a percentage), has no percentage, or has an
  unresolved `addKg`; `load: 'missingOneRm'` when its lift has no reference 1RM. Reps of such
  sets still count in the total reps; tonnage counts only sets with a rounded load.
- **Lifts of items.** A `main` item with `lift: 'selected'` uses the slot's lift; a fixed-lift
  item (e.g. a Sheiko multi-lift day) uses its own lift's 1RM and increment, and its volume is
  attributed to that lift. Filtering a day's items by the slot's lift is left to Stage 9.
- **Warnings (codes).** Session: `missingOneRm(lift)`, `unverifiedData`. Periodization:
  `invalidSlot(reason: unknownTemplate | liftNotAllowed | invalidProgramDay | invalidStartWeek)`
  (no sessions for that slot, but its session number is kept), `partialBlock(weeks)`,
  `missingOneRm(lift)` once per lift, `incompleteFrequency(templateId, lift, configured,
  prescribed)` grouped by template and lift (distinct program days of the valid slots versus
  `daysPerWeek`). The engine accepts a start week up to `durationWeeks` (as `getBlock` does);
  the slot editor offers up to `maxBlockStartWeek`, so partial blocks arise only for programs
  shorter than three weeks.
- **Activation.** `activationIssues` blocks activation when there are no sessions, a missing
  1RM (SPEC §2: no sessions for a lift without a 1RM) or an invalid slot; frequency,
  partial-block and unverified-data warnings are informational. The start date is a `YYYY-MM-DD`
  text field (default: today on the device) validated by `validateIsoDate`; a native date
  picker would need a new native module.
- **Storage (migration 006).** `session_slots(id, profile_id, position, lift, template_id,
  program_day, start_week)` with CHECKs on lift and positive day/week; positions are rewritten
  0..n−1 inside a transaction on every insert, remove and reorder. Template ids are not foreign
  keys (templates live in code); the store validates slots against the registry
  (`InvalidSessionSlotError`). `periodizations(id, profile_id, start_date, created_at, config
  JSON)` and `generated_sessions(id, periodization_id, block_week, session_number, payload JSON,
  UNIQUE(periodization_id, block_week, session_number))`. Activating again inserts a new
  periodization; nothing is deleted, and the latest one is the active periodization. The
  config snapshot holds the slots, 1RMs, rounding and parameters in effect, so Stage 6/10 read
  frozen values.
- **Reactivity.** `selectPeriodization` memoizes on the references of `sessionSlots`,
  `oneRmHistory`, `rounding` and `programParams` (last-call cache), so unrelated state changes
  return the same object and every view reading it (table now, calendar in Stage 6) is
  synchronized by construction.
- **Table layout.** At ≥ 900 px (`layout.wideBreakpoint`) the three weeks are side by side
  (rows = sessions); on narrower screens a Week 1 | 2 | 3 toggle shows one week at a time
  (SPEC §6-A allows either a pinned-column scroll or a per-week toggle; the toggle needs no
  horizontal scrolling on phones). Each set always shows `exact → rounded` (SPEC §5).
- **Program parameters in the slot editor.** Parameters are per profile and template
  (Stage 4), not per slot; the slot editor links to the program's detail screen
  ("Program settings") instead of duplicating the editor.
- **`Button.accessibilityLabel`.** Short visible labels (`↑`, `↓`, `−`, `+`) get a full accessible
  name ("Move session 2 up"), keeping the action row compact at phone width.

## 2026-11-05 — Stage 6: Calendar + session detail

- **Meaning of the session `id`.** `/session/[id]` takes the session key already produced by the
  generator, `<slotId>-w<blockWeek>` (e.g. `2-w3`), and resolves it against the **live**
  periodization (`selectPeriodization`), not against the activated snapshot. The table, the
  calendar and the detail therefore share one data source and one id space, and an edit to a slot or
  a 1RM is visible in the detail immediately (SPEC §6, §12.5). The key is stable while the slot
  exists, but it is not a durable identity: removing the slot, or a start week that ends the
  program, makes the key resolve to nothing. Activated snapshots (`generated_sessions`) are
  addressed by their own rows; Stage 10 will link logged sessions to a snapshot and can add a
  snapshot-based id form (e.g. `p<periodizationId>-<key>`) without changing this one.
- **Unknown ids.** `findSession(periodization, key)` (pure, in `src/domain/periodization.ts`)
  returns `null` for unknown, malformed, empty or removed keys; the screen then shows a localized
  "Session not found" message with a Back button instead of throwing or redirecting.
- **Views.** A `SegmentedControl` (Table | Calendar) in the Periodization screen switches the view;
  the choice is local UI state (table by default) and not persisted. The calendar is one section
  per block week with the sessions as wrapping cards (rows = weeks, one card per session), so it needs
  no horizontal scroll at phone width and fills columns on wide screens. Each card is a single
  button with a full accessible name ("Week 2, session 2: Squat, 5/3/1 (custom)") and shows the
  lift, program and one line per set (`3 × 3 @ 85% → 120.0 kg`, `→ —` when no load exists).
- **Shared rendering.** The set/accessory rendering moved from the table into
  `session-prescription.tsx` and is reused by the detail; the program source block moved into
  `programs/source-card.tsx` and is reused by the program detail. No behavior change in the table.
  Accessory notes are now shown (table and detail) when the template provides one.
- **Detail content.** Lift, program, verification badge, version, program week/phase/day,
  prescription (every set with exact → rounded load, notes, AMRAP, unverified sets as "—"),
  accessories, volume (plus per-lift volume when the session spans several lifts), session
  warning codes translated, and the program source. Performance logging entry points are Stage 10.

## 2026-11-05 — Stage 7: Smolov Jr.

- **Sources consulted (all accessed 2026-11-05).** No primary text by Sergey Smolov describing
  "Smolov Jr." was located (searches in English and Russian); Liftosaur says the program was
  introduced to Western lifters by Pavel Tsatsouline in a 2001 *Powerlifting USA* article, but that
  article could not be retrieved. The transcription therefore rests on secondary sources that agree
  with each other:
  - **Adopted reference:** smolovjr.com, "Smolov Jr. Program" (© HeavyDuty.com, 2017),
    https://www.smolovjr.com/smolov-squat-program — the day table and the week 2–3 increments.
  - Cross-checks: Lift Vault (https://liftvault.com/programs/powerlifting/smolov/, citing
    PowerliftingToWin); FitnessVolt, V. Saini, 2021 (https://fitnessvolt.com/smolov-jr-program/);
    Legion Athletics, M. Matthews (https://legionathletics.com/smolov-jr-calculator/); Liftosaur
    (https://www.liftosaur.com/programs/smolov-jr); NORMA Athletics
    (https://www.norma-athletics.at/guides/smolov-jr/); Lift5x5
    (https://lift5x5.app/blog/smolov-jr); a Sugden Barbell forum post (2022). Muscle & Strength,
    PowerliftingToWin and BarBend could not be read (HTTP 403 / empty / not found).
- **Transcription.** Every source gives the same four days, repeated each week: day 1 6 × 6 @ 70 %,
  day 2 7 × 5 @ 75 %, day 3 8 × 4 @ 80 %, day 4 10 × 3 @ 85 % (Monday / Wednesday / Friday /
  Saturday, kept as day labels). Week 2 = week 1 + 5–10 lb, week 3 = week 1 + 10–20 lb
  (smolovjr.com, Lift Vault, FitnessVolt, Legion); NORMA Athletics and Lift5x5 state it in kg as
  2.5–5 kg per week, cumulative (week 3 = week 1 + 5–10 kg). Weekdays, sets, reps and percentages
  match the SPEC §3.3-C sanity values.
- **Discrepancies.** Liftosaur suggests +10–15 lb per week for the squat (and +10 lb default); one
  article (workoutsupplementreviews.com, seen only in search results) gives +10–20 lb in week 2 and
  +5–10 lb more in week 3; a calculator uses a flat +5 lb. These are outliers or app defaults and
  were not adopted. **SPEC §3.3-C says the original range differs between upper- and lower-body
  lifts; no source consulted states separate ranges** (they give one range and only remark that
  bench lifters "use smaller jumps" without numbers). Inventing a lower-body range is not allowed,
  so a single range applies to bench and squat; the gap is recorded in the template notes.
- **Model.** One `kg` parameter `weeklyIncrementKg` (2.5–5 kg, default 2.5 kg — the lower end, which
  Lift5x5 recommends unless week 1 felt easy). Week 2 sets carry `addKg: { param }`, week 3 sets
  `addKg: { param, times: 2 }`, which reproduces "+5–10 lb / +10–20 lb" exactly and guarantees
  week 3 ≥ week 2. `ParamRef` gains `times` (positive integer, validated as
  `invalidParamMultiplier`); the generator multiplies on integer micrograms, as the Stage 5 note
  anticipated. Alternative considered: two independent parameters (week 2 total, week 3 total),
  rejected because it allows week 3 below week 2 and doubles the choice the sources describe as one
  increment. The 0.5 kg step is an input granularity of CYCLE (not in the sources); plate rounding
  still applies to the final load.
- **Verification `partial`.** All sets, reps and percentages are confirmed by several sources and
  produce loads; the status is `partial` because no primary source was found and the upper/lower
  split could not be confirmed.
- **Lifts.** `allowedLifts: ['bench', 'squat']`: the sources present Smolov Jr. for the squat or the
  bench press; none gives deadlift guidance beyond a search-result remark that it is not generally
  advised for the deadlift.
- **Parameter UI.** The slot editor shows each `kg` parameter of the slot's program (label "Weekly
  increment for session N", the range and the note that the value is shared by every session of
  that program, since parameters are per profile and template). `NumberInput` rejects values outside
  the range or off the step with a localized message and nothing is saved; the store validates
  again. The program detail has the same field and shows week 2–3 sets as `6 × 6 @ 70% + 2.5 kg`.
  Editors in other slots keep the text they were mounted with until re-rendered (no remount while
  typing, which would steal focus).
- **"Add all days of this program".** `missingProgramDays` (domain) lists the days of the slot's
  program not covered by any slot with the same program and lift; `addMissingProgramDays` (store)
  inserts one slot per missing day, in day order, right below the slot, copying its lift and start
  week. The button is shown only while a day is missing. The existing `incompleteFrequency` warning
  (Stage 5) covers the fidelity warning; it disappears once all four days are configured.

### Stage 7 — independent audit notes (orchestrator)

- An independent reviewer re-checked the Smolov Jr. transcription against smolovjr.com,
  Lift Vault, FitnessVolt, Legion, NORMA Athletics, Lift5x5, Liftosaur and BeanAnimal
  (accessed 2026-11-05): verdict ACCEPT, nothing invented.
- Clarification of the upper/lower-body note above: no source gives a *smaller* range for
  bench/upper body. Liftosaur (an app, not the original) suggests *larger* squat jumps
  (10–15 lb/week); not adopted. One range (2.5–5 kg) applies to bench and squat.
- Known modelling limitation: week 3 is fixed at 2 × the weekly increment, while sources
  let the athlete pick the week-3 jump based on week 2 (and keep the weight after failed
  sets). Candidate future improvement; not a transcription error.

## 2026-11-05 — Stage 8: Smolov (full program)

- **Sources consulted (all accessed 2026-11-05).** No primary text by S. Y. Smolov was retrieved.
  The English introduction (P. Tsatsouline, "Another Russian Super Cycle", *Powerlifting USA*) could
  not be read: dragondoor.com returned HTTP 402 / did not resolve, and the ontariostrongman.ca
  reprint (and its web.archive.org copy) returned HTTP 503 / was unreachable. Russian-language
  searches found no original table. The transcription rests on secondary sources:
  - **Adopted reference:** smolovjr.com, "Smolov Squat Routine" (HeavyDuty.com),
    https://www.smolovjr.com/smolov-squat-routine.
  - Cross-checks: Hunt Fitness, K. Hunt, 2024 (https://kylehuntfitness.com/?p=7378); My Training
    Guide, 2015 (https://mytrainingguide.blogspot.com/2015/05/smolov-squat-routine-power-lifting.html);
    Gigas Nutrition (https://gigasnutrition.com/en/blogs/training/der-vollstandige-ratgeber-zum-smolov-kniebeugen-und-smolov-jr-bankdruckprogramm,
    same text as My Training Guide); Liftosaur (https://www.liftosaur.com/programs/smolov-squat; it
    attributes the intense mesocycle to I. M. Feduleyev); J. Tadlock, 2011 (intro:
    https://justintadlock.com/archives/2011/11/21/smolov-squat-routine-introduction, base:
    https://justintadlock.com/archives/2011/12/05/smolov-base-mesocycle); Lift Vault
    (https://liftvault.com/programs/powerlifting/smolov/, partial tables only); Legion Athletics
    (https://legionathletics.com/smolov-squat-program, tables are images; text only); Wikipedia
    (structure only). Muscle & Strength, PowerliftingTechnique and PowerliftingToWin returned 403 or
    empty pages; Scribd documents did not render.
- **Transcription (sets × reps @ % of 1RM).** Week 1: days 1–2 3×8@65, 1×5@70, 2×2@75, 1×1@80;
  day 3 4×5@70, 1×3@75, 2×2@80, 1×1@90. Week 2: 1×5@80 / 1×5@82.5 / 1×5@85 (smolovjr.com, Hunt,
  My Training Guide, Gigas, Liftosaur, Tadlock agree; Lift Vault's garbled "2×2/1×3/1×5 @85%" was not
  adopted). Weeks 3–5 (Mon/Wed/Fri/Sat): 4×9@70, 5×7@75, 7×5@80, 10×3@85; week 4 = week 3 + 10 kg,
  week 5 = week 3 + 15 kg (+20 lb / +30 lb; the kg values are those of Tadlock and Gigas). Week 6:
  Monday and Wednesday rest, 1RM test on Friday or Saturday. Weeks 9–12 and 13: the tables of
  smolovjr.com, which every cross-check repeats except for the two sets below. Week 13: day 1
  1×3@70, 1×3@80, 2×5@90, 3×4@95; day 2 1×4@75, 4×4@85; day 3 final 1RM test (smolovjr.com, Hunt,
  and the "experienced lifter" taper of My Training Guide; its lighter recommended taper is quoted in
  a note).
- **Unverified (no load).** (1) The switching phase, weeks 7–8: most sources give no fixed
  prescription (speed work at ≤ 50–60 %, up to 70 % per Legion; box squats, negatives, power cleans),
  while Hunt (3×5@75 … 1×5@82.5) and Liftosaur (6×2@50 … 4×2@60) publish mutually inconsistent
  tables; even the frequency is not confirmed, so all four day slots are an unverified informational
  item with the sources' description in the note. (2) Week 9 day 1 last set 1×5: 85 % (smolovjr.com,
  Hunt) vs 90 % (Liftosaur, My Training Guide, Gigas). (3) Week 12 day 3 last set 3×4: 95 %
  (smolovjr.com, Hunt) vs 80 % (Liftosaur, My Training Guide, Gigas). Sets and reps of (2) and (3) are
  kept; the percentage is left out with a note naming both readings. Verification: `partial`.
- **Schema extension — fixed increments.** `addKg` is now `ParamRef | { kg: number }`. The base
  mesocycle increments are fixed by the original, not chosen by the athlete (SPEC §3.4), so they are
  not configurable parameters; the sources' advice to skip an increment after missed sets is a note.
  `addKgValue(ref, values)` (params.ts) resolves both forms on integer micrograms; the validator adds
  `invalidFixedKg` (must be a positive finite number).
- **Schema extension — informational items.** `PrescriptionItem` gains `{ kind: 'info'; text; note?;
  unverified? }` for day content that has no sets: rest days, 1RM tests ("work up to a new max": the
  original gives no percentage, so a main set would have to be flagged unverified, which it is not)
  and the switching phase. Info items carry no load or volume; an unverified one requires a note,
  is forbidden in a `verified` template and raises the session's `unverifiedData` warning. They are
  rendered as plain text (not "Accessory: …") in the program structure, table, detail and calendar.
- **Variable frequency.** The schema keeps a constant `daysPerWeek`; Smolov uses 4 day slots in every
  week (its maximum). Weeks with three sessions (1–2, 9–13) have a rest-day info item in day 4, and
  week 6 has rest in days 1–2 and the test in days 3–4 (one test, on either day). Alternative
  considered: variable day counts per week, rejected because slots, the "add all days" shortcut and
  the frequency warning all key on a fixed day number. The frequency warning therefore counts 4
  days. Day labels (Monday / Wednesday / Friday / Saturday) are set only for the base mesocycle;
  the sources disagree on weekdays elsewhere (intro Mon/Tue/Wed vs Mon/Wed/Fri; intense Mon/Wed/Sat
  vs Mon/Wed/Fri).
- **1RM basis.** The intense mesocycle and taper use the new 1RM tested in week 6; a note on those
  items asks the athlete to update the reference 1RM (CYCLE always uses the current one). Some
  sources suggest training off 90 % of the 1RM; not modelled (no training-max concept in the SPEC).
- **Block selection.** The existing start-week stepper covers weeks 1–11 (`maxBlockStartWeek` =
  13 − 2), so every three-week block can be browsed; `getBlock` also returns the partial blocks at
  weeks 12 (two weeks) and 13 (one week), which are tested. Lift fixed: `allowedLifts: ['squat']`,
  `liftSelectable: false`. Not included: the lunges and Olympic lifts some sources mention for the
  introductory and switching phases (no quantified prescription).

### Stage 8 — independent audit notes (orchestrator)

- An independent reviewer re-checked every week/day of the Smolov transcription against
  smolovjr.com, Hunt Fitness, My Training Guide, Gigas Nutrition, Liftosaur, Justin
  Tadlock and Wikipedia (accessed 2026-11-05): verdict ACCEPT, nothing invented; the
  +10/+15 kg base increments are the sources' own kg equivalents; the unverified items
  (switching phase, week 9 day 1 and week 12 day 3 last sets) are exactly the disputed
  or missing ones.
- Non-blocking follow-ups: weekday labels for weeks 1–2 (week 1 Mon/Tue/Wed, week 2
  Mon/Wed/Fri per Tadlock/Hunt); disclose that non-squat intro work (lunges) is not
  transcribed.

## 2026-11-05 — Stage 9: Sheiko (multiple templates)

- **Sources consulted (all accessed 2026-11-05).** No primary text by B. Sheiko with the numbered
  routines was located. The sheiko-program.ru forum, which the circulated spreadsheets cite, now serves
  unrelated (gambling) content; PowerliftingToWin returned an Incapsula challenge page; Scribd uploads
  did not render. Readable sources:
  - **Adopted reference:** Lift Vault, "Sheiko Program Spreadsheets" (Google Sheets, linked from
    https://liftvault.com/programs/powerlifting/sheiko-spreadsheets/,
    https://docs.google.com/spreadsheets/d/1vBdL47glReiNALmFw1_ieRg6nMYaJ5OFlmidJ9nUNNM/edit), the
    spreadsheet "Made by ChaseT 2008.05.09" with one tab per routine ("Monthly training plan #N": #29,
    #30, #31, #32, #37, #39, #40). Each row is % / reps / sets, and the weight formula multiplies the %
    by the squat, bench or deadlift max (variations included). It was exported as `.xlsx` and parsed
    cell by cell, formulas included.
  - Cross-check 1: Liftosaur, "Sheiko #29-32" (https://www.liftosaur.com/programs/sheiko-29-32), a
    16-week program text (#29 = weeks 1–4 … #32 = weeks 13–16). It agrees with the adopted tabs on
    every main-lift set of #29, #30 and #31 (36 days) and on #32 except one day (below). It replaces
    some accessories (e.g. dumbbell bench instead of incline bench, chest fly instead of dumbbell fly)
    and adds its own default weights, so accessories were taken from the spreadsheet.
  - Cross-check 2: Lift Vault, "Sheiko 3 Day Under 80 kg" workbook (ChaseT format,
    https://docs.google.com/spreadsheets/d/12VzUk4JAWHulBnYfJIo4-JUAEe9yBxD6F5hy1jw9eKk/edit), tabs
    "#37" and "#32": identical to the adopted tabs on every main set and accessory.
  - Seen but not used for data: Boostcamp "Sheiko Template #37" (community page, week 1 only; same
    content, but the bench pyramid is merged and reordered); Jefit "Sheiko 37v2" (no percentages, a
    different variant).
- **Templates shipped:** `sheiko-29`, `sheiko-30`, `sheiko-31`, `sheiko-32`, `sheiko-37` (one file
  each, `src/programs/data/sheiko-<number>.ts`, shared helpers in `sheiko-common.ts`), each 4 weeks ×
  3 days (Monday / Wednesday / Friday, the spreadsheet's "1 / 3 / 5 day"), `allowedLifts` = all three,
  verification `partial` (consistent secondary transcriptions, no primary source). **Not shipped:**
  #39 and #40. Only the adopted spreadsheet has them; no second readable transcription was found.
  Shipping fewer, cross-checked routines was preferred.
- **Variants not mixed (SPEC §3.1 rule 2).** The under-80 kg workbook's "#30", the over-80 kg workbook's
  "#31", "#37v2" and "#32v2" tabs are different programs (other bench and squat work, other set
  counts), not transcriptions of the numbered routines. They were not used. A combined 16-week
  "#29–#32" template (Liftosaur's layout) was not created; the four routines are separate templates
  that can be run back to back.
- **Discrepancy: #32 week 1 Wednesday (max-test day).** After the 90% single, the adopted spreadsheet
  and the under-80 kg workbook give "100%-105% × 1 × 2-3" for each lift, and Liftosaur gives 3 × 1 @
  100%. There is no single set count or percentage, so each lift has an unverified informational line
  ("Max attempts: 2–3 singles at 100–105% of 1RM") with both readings in the note and no load. The sets
  up to 90% are calculated. #32 week 4 has two training days and then "5-6-7 day: Competition"
  ("Competition / Test" in the under-80 kg workbook), stored as day 3 with the label "Days 5–7" and an
  informational line.
- **Transcription details.** Rows with a formula on the lift's max are main items; rows without
  are accessories (`kind: 'accessory'`, "5 sets × 10 reps", no weight, as in the source). The #31
  squat ladders (reps "2,4,6,8,7,5,3" and "5,8,3,6,2,7,4" at 70%, one set each, as the volume column
  confirms: 35 reps) are seven single sets in the source order. Accessory names follow the source
  ("Press", "Triceps", "Abs" are not expanded); "Leg Press" / "Leg press" and "Incline Bench press"
  are normalized in case only. Exercise numbering typo "1, 1, 3" in #32 week 4 Monday (present in both
  spreadsheets) does not affect the order.
- **Schema extensions.** `MainItem.exercise?: LocalizedText` names a variation (deadlift up to knees,
  from boxes, deficit deadlift, front squat). Its percentages refer to the competition 1RM of `lift`
  (SPEC §3.3-D), which is what the spreadsheet computes, so they are calculated and counted in that
  lift's volume. `InfoItem.lift?: Lift` ties an informational line to one lift of a multi-lift day.
  `ProgramTemplate.variant?: string` is the short label used inside a family ("#29"). The validator
  rejects blank values and info lifts outside `allowedLifts`.
- **Multi-lift days (engine).** A slot calculates only the items of its own lift (main items with that
  lift or `selected`, lift-tied info lines). Main items and lift-tied info lines of other lifts go to
  `GeneratedSession.otherItems` unchanged (the original prescription, no load, no volume, no
  `missingOneRm` or `unverifiedData` warning for the slot). Accessories and info lines without a lift
  stay in `items`. This replaces the Stage 5 behavior ("a fixed-lift item uses its own lift's 1RM")
  for items of another lift. A Sheiko day trains up to three lifts, and calculating them all in every
  slot would count the same work again in each lift's slot and require 1RMs for lifts the user does
  not assign. When a day has items for other lifts only (e.g. a deadlift slot on #29 Monday), the
  session gets the warning `liftNotInDay`. Activated snapshots saved before this stage have no
  `otherItems`; readers (Stage 10) should treat it as empty.
- **Frequency.** The existing `incompleteFrequency` rule (distinct days per template and lift versus
  `daysPerWeek`) is kept: a deadlift slot on one Sheiko day reports "1 of 3". It is informational;
  "Add all days of this program" adds the other two days, which show the deadlift work they contain
  (or the `liftNotInDay` warning).
- **UI.** The slot editor's program control lists one option per family (`groupByFamily`, registry):
  a single-template family shows its template name, and a family with several templates shows its
  localized family name ("Sheiko"). A second control "Template for session N" lists the variants
  (#29 … #37). Choosing the family selects its first template; switching template keeps the day and
  the start week (4-week templates: start week 1–2, partial blocks at 3–4 via `getBlock`). The
  Programs screen groups the Sheiko templates under a "Sheiko" heading. Variation names are shown as
  "Deadlift — Deadlift from boxes" (program structure, other-lift lines) or as the item label
  (session views). Other lifts appear under "Other lifts this day (information, not calculated)"
  in the table and the session detail; the calendar cards show the slot lift only.
- **SPEC §13 Session 4.** Deadlift / Sheiko #29, day 2 (Wednesday: deadlift up to knees + deadlift
  from boxes) is the reference configuration of `src/domain/sheiko-loads.test.ts`. It uses
  hand-computed loads for deadlift 180 kg, 2.5 kg, nearest (e.g. week 1: 90, 107.5, 125, 135 / 100,
  117.5, 135, 152.5 kg; tonnage 7,065 kg).
- **Test method.** The data files were generated from the parsed adopted spreadsheet. The expected
  day tables in `sheiko-<number>.test.ts` take their main-lift sets from the second transcription
  (Liftosaur for #29–#31, the under-80 kg workbook for #32 and #37), so each data test compares the two
  sources. The notation helper is `src/test-utils/program-notation.ts`.

### Stage 9 — independent audit notes (orchestrator)

- An independent reviewer exported every tab of the adopted workbook (ChaseT 2008 via
  Lift Vault) and the "Under 80 kg" workbook as CSV and compared them programmatically
  with the five templates (#29, #30, #31, #32, #37), all 12 days each, including
  accessories and variation-to-lift attribution (checked by weight ÷ %): verdict ACCEPT,
  no mismatches, nothing invented. The #32 week-1 max attempts as unverified info items
  were confirmed as the right handling.
- Minor wording: the Under-80 #37 tab orders one W1 Monday accessory differently; every
  set agrees.

## 2026-11-05 — Stage 10: performance tracking + RIR/RPE

- **Logging is against the activated snapshot, not the live draft.** A `performed_sessions` row
  belongs to `(periodization_id, session_key)` (`UNIQUE`), i.e. to a session of an activated
  periodization (`generated_sessions`), so the prescription it answers can never change when slots,
  1RMs or increments are edited (SPEC §10). The route `/session/[id]` accepts a second id form,
  `p<periodizationId>-<slotId>-w<blockWeek>` (anticipated in the Stage 6 notes), that loads the
  frozen session from persistence and shows the logger above the usual prescription cards. The
  plain key still means the live periodization (calendar, table). From a live session, "Log this
  session" jumps to the snapshot form of the active periodization when it contains that key;
  otherwise the screen says to activate the periodization or that the session is not part of it,
  and a note warns that the snapshot's loads may differ from the live ones. Alternative considered:
  logging against the live session and copying its loads, rejected because an edit between two
  visits would silently change what a draft is compared with. Sessions of older activations stay
  reachable (the Training tab lists their drafts), but only the latest activation feeds "next
  session".
- **Tables.** `performed_sessions` (copies of session number, week, lift and template so a record is
  readable without the periodization; `status` `in_progress | completed`; a `CHECK` ties completion
  to `completed_at` and `snapshot`) and `performed_sets` (position, the prescription each set
  answers — `prescribed_index`, `prescribed_weight_kg`, `prescribed_reps`, all `NULL` for an extra
  set — and weight, reps, RIR, RPE, notes). `weight_kg`/`reps` may be `NULL` only while a draft;
  the repository re-validates before completing. Other SPEC §12.2 tables stay for later stages
  (`e1rm_history` in Stage 11).
- **Draft = the row itself.** `saveDraft` overwrites the record and its sets in one transaction on
  every edit (SPEC §7 "immediate local save"); there is no separate draft table or debounce. The
  store serializes saves (`savePerformedDraft`/`completePerformedSession` share a queue), so rapid
  typing cannot reorder writes. The record is created on the first edit, not when the screen opens,
  so merely viewing a session does not make it "in progress". Fields with an invalid value are
  stored empty in the draft (the typed text stays in the form); completion needs every value valid.
- **Completion snapshot.** `PerformanceSnapshot` = the activated `GeneratedSession`, the lift's 1RM
  and the increment/rounding mode in effect at activation (read from the periodization config), the
  periodization id and start date. Together with the per-set prescribed values it makes a completed
  session independent of later 1RM changes (tested through the store and the UI). Completed
  sessions are final in Stage 10 (`saveDraft` throws `PerformedSessionCompletedError`); editing a
  past session (SPEC §10) belongs to Stage 13. One record per session of a periodization: repeating
  a session means activating again.
- **Domain rules (`rpe.ts`, `performance.ts`).** `RPE = 10 − RIR`; RIR 5 stands for "5+" (the table
  row is "RPE ≤ 5", stored as 5) and `5+` is accepted as input; RIR 10 has no RPE (the scale starts
  at 1). RIR is validated as 0–10 in half steps because half points arise from RPE conversion
  (RPE 8.5 → RIR 1.5); the logging form's RIR field accepts whole numbers and `5+`, and also shows
  (and accepts back) those half points. Editing either field rewrites the other, so the form cannot
  produce a divergence; the check "differ by more than 0.5 → `rirRpeMismatch`" is domain/repository
  validation. Limits that SPEC §7 leaves open were fixed: weight > 0 and ≤ 1000 kg with at most 2
  decimals, reps an integer 0–100, notes ≤ 500 characters (per set and per session). Reps are not
  pre-filled (only the load is, per SPEC §7); an extra set starts from the previous set's weight.
- **Prescribed sets.** `prescribedSets(session)` expands `repeat` and lists only the slot lift's
  main items (variations such as "Deadlift from boxes" included, with their name); accessory and
  info lines and `otherItems` (multi-lift days) are not logged. Sets without a load (unverified / no
  1RM) are logged without a prescribed weight and with no weight delta. A prescribed set cannot be
  removed from the form; a skipped set is entered with 0 reps (failure) so the comparison keeps it.
  AMRAP sets compare against their minimum reps.
- **Prescribed vs. actual.** Per set: Δ kg and Δ reps (extra sets have none); per session:
  prescribed tonnage (Σ prescribed reps × load of the sets with a load) vs. performed tonnage
  (every set with weight and reps, extra sets included), summed on integer micrograms.
  Snapshots activated before Stage 9 have no `otherItems`; the logger never reads them.
- **Training tab.** `selectTrainingQueue`: `inProgress` = all drafts (any activation, newest edit
  first); `next` = first session of the latest activation, by block week then session number, that
  has at least one prescribed set and no record. Sessions with nothing to log (rest days, a lift
  with no work on a multi-lift day) are skipped so they cannot block the queue. It opens
  `/session/p<id>-<key>`. The placeholder text `screens.training.placeholder` was removed.
- **Not in this stage.** e1RM display after a set (Stage 11), history list and editing completed
  sessions (Stage 13). The Dashboard still shows its placeholder.

## 2026-11-05 — Stage 11: e1RM engine + session estimate

- **RTS chart sources (all accessed 2026-11-05).** The original chart of M. Tuchscherer, *The Reactive
  Training Manual* (2008), was not retrieved: the elitefts.com excerpt of chapter 2
  (https://elitefts.com/blogs/training/rate-of-perceived-exertion-rpe) refers to the chart without its
  values, and the "Beginning RTS" documents on Scribd did not render. Two published versions were
  compared cell by cell (reps 1–12 × RPE 10, 9.5 … 6):
  - **Circulated chart:** SensAI (https://www.sensai.fit/tools/rpe), AIFitHub
    (https://aifithub-monorepo.pages.dev/methodology/rpe-to-percentage-converter/) and Fitness Volt
    (https://fitnessvolt.com/rpe-training/; reps 1–10 × RPE 10–6.5 also on
    https://fitnessvolt.com/rpe-training/guides/tuchscherer-chart-explained) give the same 108 cells,
    except 12 reps @ RPE 6: 57.2 % (SensAI, AIFitHub) vs 57.4 % (Fitness Volt).
  - **RTS TRAC table:** the `strength` R package 0.1.0.9000, data set `rpe_tab_rts`, documented as
    "pulled from the TRAC system on Reactive Training Systems in Dec 2025"
    (https://alexpaynter.r-universe.dev/strength, https://github.com/alexpaynter/strength). The `.rda`
    file was read programmatically.
  - Seen, not adopted: the Fitness Volt RPE calculator (https://fitnessvolt.com/rpe-calculator/) shows a
    third curve beyond 10 reps to failure (e.g. 72.8 / 71.7 / 70.7 …), inconsistent with the site's own
    chart page.
- **Transcription rule.** A cell carries a percentage only where both versions agree (64 cells). The
  other 44 cells are `'unverified'` and produce no RTS estimate (SPEC §3.1 rule 6 applied to the
  chart); both readings are kept in `RTS_UNVERIFIED`. Disagreements: 93.9 vs 93.8 (n = 2.5: 1 @ 8.5,
  2 @ 9.5), 79.9 vs 79.8 (n = 7.5: 4 @ 6.5, 5 @ 7.5, 6 @ 8.5, 7 @ 9.5), and every cell with
  `n = reps + RIR ≥ 10.5`, where TRAC is flatter (e.g. 12 @ 10: 68.0 vs 70.7). In practice the RTS
  formula estimates sets up to 10 reps to failure; Epley/Brzycki still go to n = 12. A data test checks
  every cell, the list of unverified cells with both readings, and the chart diagonal
  (`pct(r, RPE) = pct(r + 1, RPE + 1)`). SPEC §8.1 "half points interpolated": the chart already has
  half-point columns, so nothing is interpolated; an RPE outside 6–10 in half points is outside the chart.
- **SPEC §8.1 acceptance example (80 kg × 5 @ RIR 1).** `rts`: 80 / 0.837 = 95.579… → **95.6 kg**;
  `epley-rir` 96.0 kg; `brzycki-rir` 92.9 kg.
- **Arithmetic and rounding.** Integers only: weight in centikilograms, `n` in half reps, percentages in
  tenths; the e1RM is rounded to 0.1 kg (halves up) and stored and displayed with one decimal. RIR
  comes from the logged RIR, else `10 − RPE`; half points (RPE 8.5 → RIR 1.5) are supported. Epley with
  `n = 1` returns the weight (SPEC); Brzycki has no value from `n ≥ 37`. Δ % against the previous
  estimate is rounded to 0.1 (halves away from zero).
- **Validity (SPEC §8.2).** `estimateSet` returns `valid` (reps ≥ 1, RIR ≤ 4, n ≤ 12, RTS cell verified),
  `lowConfidence` (`rirAbove4` before `beyondRepLimit`; a value is shown when the formula has one, never
  stored — the RTS formula never has one there, because RPE < 6 is off the chart and n > 12 is in the
  unverified region), `unverified` (valid set on a disputed RTS cell: no estimate) or `none` (no weight,
  0 reps / failure, or no RIR and no RPE: nothing is shown).
- **Representative set (SPEC §8.3).** Per lift: valid sets only; smallest n, then heaviest weight, then
  lowest RIR, then first set. Sets of a named variation (`exercise`, e.g. "Deadlift from boxes") are not
  the competition lift and are left out; extra sets count for the session lift. Per-set estimates are
  shown for information, in the logger and in the completed summary (with the formula of the stored
  estimate).
- **Storage (migration 008).** `settings.e1rm_formula` (`CHECK` on the three ids, default `rts`; a column,
  like `onboarding_completed`) and `e1rm_history(profile_id, lift, performed_session_id, set_position,
  recorded_at, value_kg, formula, weight_kg, reps, rir, UNIQUE(performed_session_id, lift))` with CHECKs
  matching validity (reps ≥ 1, 0 ≤ RIR ≤ 4) and cascades from the profile and the performed session.
  `recorded_at` is the session's completion time. The repository is append-only (`record`, `list`); a
  second estimate for the same session and lift raises `E1rmAlreadyRecordedError`. Stage 13 (editing a
  past session recomputes its e1RM) will need a replace operation for that one row.
- **When it is written.** `completePerformedSession` completes the record, then stores one estimate per
  lift with the formula in effect. The two writes are not one transaction (the repositories have no
  shared transaction API); a failure between them leaves a completed session without an estimate, which
  Stage 13's recompute can fill.
- **Formula changes do not rewrite history.** Each record keeps its formula and the source set (weight,
  reps, RIR), so another formula is a view (`estimateSet(record, formula)`), tested in the store; only
  new sessions use the new formula. The comparison shows the previous stored value as stored, even if it
  used another formula.
- **Previous e1RM.** The stored estimate of the same lift just before this one in history order (date,
  then insertion); for a session not completed yet, the latest one of the lift. Shown as
  `Previous e1RM: 92.9 kg · Δ +2.7 kg (+2.9%)`, or "First e1RM for this lift."
- **"Use as new reference 1RM".** In the completed summary, per stored estimate; it opens an inline
  confirmation (lift, value, current reference) with Confirm / Cancel — never automatic. Confirming
  appends a `reference_1rm_history` record (origin `from_e1rm`, effective now) through the store; the
  value is validated with the SPEC §2 rules first, so an e1RM above 600 kg shows "Must be at most 600"
  and nothing is recorded. The live periodization recalculates from the new current 1RM; activated
  snapshots and completed sessions do not change.
- **Settings.** "Estimated 1RM (e1RM)" section with a three-option segmented control (RTS chart /
  Epley (RIR) / Brzycki (RIR)) and a note that stored estimates keep their formula.

### Stage 11 — revised RTS chart adoption (orchestrator review)

- **Change.** The adoption rule above ("a cell is a number only where the circulated chart and the RTS
  TRAC table agree") is replaced. SPEC §8.1 names Tuchscherer's chart from *The Reactive Training
  Manual* (2008) as the source; the TRAC table (`strength` R package, Dec 2025) is a later, revised
  RTS version, not a competing transcription of that chart, so disagreeing with it does not make a
  cell unverified.
- **Source of record.** The widely circulated Tuchscherer chart, as given identically by SensAI,
  AIFitHub and Fitness Volt (URLs above, accessed 2026-11-05). Every cell where those sources agree is
  adopted: 107 of 108 cells.
- **Unverified (1 cell).** 12 reps @ RPE 6: 57.2 % (SensAI, AIFitHub) vs 57.4 % (Fitness Volt). It
  produces no estimate (`RTS_UNVERIFIED`). Every other cell is given by all readable sources; Fitness
  Volt's chart-explained page covers reps 1–10 × RPE 10–6.5 and agrees.
- **Discrepancy note: RTS TRAC.** TRAC differs in 44 cells, kept as `RTS_TRAC_DIFFERENCES`
  (`[chart, TRAC]`) and not used for estimates: 93.9 vs 93.8 at 1 @ 8.5 and 2 @ 9.5; 79.9 vs 79.8 at
  4 @ 6.5, 5 @ 7.5, 6 @ 8.5 and 7 @ 9.5; and every cell with `n = reps + RIR ≥ 10.5` (7 @ 6.5, 7 @ 6;
  8 @ 7.5–6; 9 @ 8.5–6; 10 @ 9.5–6; all of 11 and 12 reps), where TRAC is flatter (e.g. 12 @ 10:
  68.0 vs 70.7; 12 @ 6: TRAC 65.0). The Fitness Volt RPE calculator page, with its own curve beyond 10
  reps to failure, also stays a note.
- **Effects.** 1 @ RPE 8.5 and the other cells listed above produce RTS estimates again (e.g.
  100 × 1 @ RPE 8.5 → 100 / 0.939 = 106.5 kg); the RTS formula now covers up to n = 12 like Epley and
  Brzycki, and RTS low-confidence sets with n > 12 within the chart show a value (60 × 10 @ RIR 3 →
  60 / 0.653 = 91.9 kg, not stored). The `unverified` estimate status remains for the one disputed
  cell; it is reachable only as a low-confidence set (12 reps @ RIR 4 is n = 16). The SPEC §8.1
  example is unchanged (5 @ RPE 9 = 83.7 % → 95.6 kg).

### Stage 11 — review and audit notes (orchestrator)

- Review decision: the RTS TRAC table (2025) is a later revision of RTS's chart, not a
  transcription of the 2008 Tuchscherer chart named by SPEC §8.1, so it is kept as a
  discrepancy note only; the circulated Tuchscherer chart is the source of record.
- An independent reviewer compared all 108 cells against sensai.fit, AIFitHub and Fitness
  Volt (accessed 2026-11-05): 107 match all three exactly; 12 reps @ RPE 6 (57.2 vs 57.4)
  is the only unverified cell. The table also follows the chart's known single-sequence
  diagonal structure. Formulas, validity, rounding and the representative-set rule match
  SPEC §8: verdict ACCEPT.

## Stage 12 — Strength progression dashboard + charts

- **Library.** `react-native-svg` 15.16.0 (installed with `npx expo install`, the SDK 58 version) and an
  in-house `LineChart`; no charting library (SPEC §9).
- **Pure statistics (`src/domain/stats.ts`).** Periods: 4 weeks = 28 days; 3 months, 6 months and 1 year
  are calendar months counted back from `now` in UTC, the day clamped to the end of a shorter month
  (31 May − 3 months = 28 Feb). `all` has no start. The clock is an argument.
- **Which numbers follow the period.** Current reference 1RM and the latest / previous / highest e1RM are
  always over the whole history (they are facts about the lift). The period sets the baseline and the
  chart range. Improvement = latest e1RM − baseline, where the baseline is the reference 1RM in effect at
  the start of the period (last record at or before it); for `all` it is the first record. If no record
  was in effect yet at the start (the first one is later), the first record is used. If the latest e1RM is
  older than the period start there is no improvement ("No e1RM in this period") rather than a
  comparison of an old estimate with a recent baseline. Without any reference 1RM there is no baseline.
- **Rounding.** Δ kg and Δ % are computed on integer cents (no float noise: 92.9 − 90 = 2.9); Δ % is in
  percent units to 0.1, halves away from zero, like `compareE1rm`, and shown with `formatPercent`.
- **Chart model in the domain (`src/domain/chart-scale.ts`).** `niceTicks` (1/2/5 × 10^k steps, about five
  ticks; a lone value is padded by 5 kg each side), `linearScale`, `timeTicks` and `buildChartModel`
  produce the pixel coordinates so layout is tested with exact values; the component only draws.
  The x range is `[period start, max(now, last point)]`, or the whole history for `all` (one day of
  padding each side when it is a single instant). The reference line is a step line: the value in effect at
  the period start, each change inside the period as a vertical step, extended to the right edge. The
  y domain covers the visible e1RMs and reference values. Three x ticks (start, middle, end).
- **Interaction.** Every e1RM point has a transparent 44 pt `Pressable` (accessible button labelled with
  date and value). Press selects / deselects it, hover selects it; the date, value (labelled as an
  estimate) and originating session (`Session N, week W · program`, from the performed session) appear
  in a polite live region under the chart. An SVG `<Text>` cannot be queried or scaled by the OS, so the
  axis labels are React Native `Text` overlays; the SVG holds only grid, lines and points. The chart has a
  localized summary label.
- **Empty states.** No e1RM at all for a lift: "No e1RM yet…" (cards still show the reference 1RM or
  "Not set"); e1RMs exist but none in the period: "No e1RM for {lift} in {period}."
- **Data source.** The screen reads `oneRmHistory`, `e1rmHistory` and `performedSessions` from the store
  (no new repository methods or migrations); it is reactive to new records. The clock is injectable
  (`now` prop) and refreshed when the period changes.

## Stage 13 — Training history

- **Routes.** History is a stack route opened from the More tab (as Programs and Settings): `/history` (list) and
  `/history/[id]` (detail), where `id` is the performed session id. SPEC §10/§11 do not make it a tab. The "Coming
  soon" card of More was replaced by the link. The sidebar keeps its five sections (the Stage 14 audit decides
  whether wide screens get a History entry).
- **What an entry reads.** `HistoryEntry` (pure, `src/domain/history.ts`) is built from the completed performed session
  (its copied identifiers, sets and notes), the completion snapshot (`templateVersion`, `programDay`, start date and the
  reference 1RM at activation) and the session's current e1RM estimates. It never reads the live periodization, the
  current 1RMs, rounding or program parameters, so changing any of them cannot alter the history (tested at the store and
  UI level: bench 1RM 100 → 105 plus a new activation leave the list and the detail unchanged). Drafts are not history.
- **Order and filters.** Newest completion first (`completedAt` as an instant; equal instants: the latest record first).
  Filters: lift, program (template id) and the same periods as Progress (`stats.periodStart`: 4 weeks = 28 days, then
  calendar months in UTC; the start instant is included; default All). The program chips list only programs present in
  the history and are hidden while there is a single one. Filters combine with AND.
- **"Equivalent previous sessions" (SPEC §10 "same lift/program/day").** Completed sessions with the same lift, the same
  program (template id) and the same program day (`snapshot.session.programDay`), recorded strictly before the session
  in history order (completion instant, then record id). The block week, the program version and the periodization are
  *not* part of the definition: week 1 of the previous cycle and week 2 of the same cycle both count, because the
  comparison is about the same workout of the same program. A session with no known program day has none. The 3 most
  recent are shown, newest first, each with the tonnage and the Δ of the open session against it (open − earlier) and the
  e1RM with Δ kg / Δ % (`compareE1rm`), or "not available" unless both sessions have an e1RM. Alternatives rejected:
  requiring the same block week (a 3-week block would rarely repeat) or the same template version (a transcription fix
  would cut the history in two).
- **Editing a past session (SPEC §10).** `PerformanceRepository.amend` replaces the sets and notes of a *completed*
  session with the same validation as completion; the completion date and the snapshot are untouched and `updatedAt`
  becomes the edit time (an entry is "edited" when `updatedAt > completedAt`). The UI reuses the logger form in an edit
  mode: nothing is stored until "Save changes" (no autosave, a draft cannot be confused with a completed session) and
  "Cancel" discards. Only the sets, notes and the session's own e1RM change; the prescription (`prescribed_*` of each set)
  is kept as logged. Edits go through the same serialized queue as draft saves.
- **How an edit supersedes the e1RM while `e1rm_history` stays append-only (migration 009).** The table becomes a log of
  revisions: `revision` column, `UNIQUE (performed_session_id, lift, revision)` instead of one row per session and lift
  (the table is rebuilt because SQLite cannot relax a UNIQUE; existing rows become revision 1 keeping their ids). The
  current estimate of a session and lift is its highest revision, and `list` returns exactly those, so Progress, the
  completed summary and "previous e1RM" see the corrected value with no change on their side. A revision keeps the
  session's original `recorded_at` (completion time), so the point does not move on the chart or in the order; it keeps
  its own formula, source set, weight, reps and RIR. When an edit leaves no valid set, a *tombstone* revision (all
  estimate columns `NULL`, enforced all-or-none by a `CHECK`, formula and date copied) hides the old estimate; a later edit
  appends the next revision. New repository methods: `supersede` (next revision, the first when none), `clear` (tombstone
  or `false` when there is nothing to clear) and `revisions` (every row of a session, the audit trail); `record` still
  refuses a session that has any revision, so the completion write cannot overwrite history. Other sessions' rows are never
  touched, and the store skips the write when the recomputed estimate equals the current one (a notes-only edit adds no
  revision). Ordering ties on equal dates use the id of the session's *first* revision, so a revision does not reorder
  sessions. `adoptE1rmAsReference` keeps working on the current record (ids change with a revision).
- **Which formula an edit uses.** The formula of the session's existing estimate, so correcting a typo does not silently
  change the basis of an old estimate when the setting changed since; a session with no estimate uses the formula in
  effect (this also fills the missing estimate after a completion that failed between its two writes, Stage 11). The
  edit form's live estimate follows the same rule, and its "previous e1RM" is the estimate before the session's date.
- **Detail view.** Per set: the prescription as logged (`Prescribed: 3 reps @ 85.0 kg`), the performed values with
  RIR/RPE, Δ kg / Δ reps, the set's e1RM; then the tonnage against the prescription, the stored session e1RM with the
  previous-e1RM comparison and "Use as new reference 1RM" (the existing component), a note when the estimate is a revision,
  and the snapshot note (activation date and reference 1RM at that time). List items summarize consecutive equal sets
  (`2 × 75.0 kg × 5; 80.0 kg × 5 · RIR 1 · RPE 9`, `3×5 @ 75.0 kg`).
- **Not in this stage.** Deleting a session, editing the prescription, a History entry in the wide-screen sidebar.

## Stage 14 — Dashboard, responsiveness and audits

- **Dashboard content (SPEC §11).** Four blocks: *Current block* (week N of 3 from the activation start date, "Starts in N
  days" before it and "Block finished" after week 3, the start date, and a "sessions in progress" line with a link to
  Training), *Next session* (the Training queue's next pending session with a Start button that opens the logger, or "every
  session started"), *Latest e1RM* (per lift: the most recent stored estimate with its date, plus the current reference 1RM;
  lifts without an estimate show "—" and the reference), and *Shortcuts* (Training, Periodization, Progress, History).
  With no activated periodization the block card explains how to start and links to Periodization; the e1RM card still shows
  the reference 1RMs. The week is computed from calendar days (`blockProgress`, pure, local date of "today" against the ISO
  start date) so the time of day and DST never move a boundary; each block week lasts 7 days. The clock is injectable (`now`).
- **Latest e1RM.** `selectLatestE1rms` takes the record with the latest `recordedAt` (ties: the higher id). The e1RM history
  already holds only the current revision of each session (Stage 13), so a corrected session is read at its corrected value.
- **Sidebar with every section.** SPEC §11 lists Dashboard, Periodization, Programs, Calendar, Training, Progress, History and
  Settings for wide screens; Programs, History and Settings are stack routes (not tabs), so a sidebar rendered by the tab
  navigator would vanish on them. The sidebar is therefore rendered by `AppShell` in the root layout, beside the whole stack,
  at widths ≥ 900 px, and the tab navigator hides its own bar there. The active entry comes from `usePathname()` (a section
  by first path segment; `/more` and `/session/*` highlight nothing). Mobile keeps the five tabs unchanged (More still lists
  Programs, History and Settings). Alternatives rejected: moving those routes under `(tabs)` as hidden tabs (nested stacks,
  route and test churn) and duplicating a sidebar in each screen.
- **Calendar entry.** Calendar is a view of Periodization, not a route: the entry opens `/periodization?view=calendar` and
  Periodization entry opens `?view=table`. `PeriodizationScreen` takes optional `view` / `onViewChange` props and the route
  keeps the view in the `view` search param, so the sidebar highlight follows the Table | Calendar toggle and the view is
  linkable. Without the props the screen keeps its own state (existing behavior).
- **Accessibility audit.** Touch targets: every `Pressable` is a ≥ 44 pt control or a full-width card; the sidebar items and
  Dashboard buttons are tested. Contrast: the red accent `#D32F2F` passes AA as a fill with white text (4.98:1) but not as
  *text* on the dark surfaces (4.22 / 3.76 / 3.42:1), so `tone="accent"` text now uses a new `accentText` token (`#FF6B6B` dark,
  `#B71C1C` light), asserted ≥ 4.5:1 on all three backgrounds of each scheme. Labels: every dashboard button has an accessible
  name (shortcuts read "Open Training", distinct from the tab names) and each lift summary is one labelled element.
- **i18n audit.** `src/i18n/no-hardcoded-strings.test.ts` parses every `.tsx` in `src/app` and `src/components` with the
  TypeScript compiler (`test-utils/find-hardcoded-text.ts`) and fails on JSX text, string/template literals used as children
  and literal `label` / `accessibilityLabel` / `accessibilityHint` / `placeholder` / `title` / `hint` / `alt` props that contain a
  letter (symbols such as `+`, `−`, `↑` and numbers are allowed). The audit found no existing offender; key parity,
  placeholder parity and locale formatting (`formatKg`, `formatDate`) were already enforced. The Stage 1 placeholder screen
  (`PlaceholderScreen`, `common.comingSoon`, `screens.dashboard.placeholder`) was removed: no placeholder screen is left.
- **Desktop review.** The three-week table (weeks side by side at ≥ 900 px, week toggle below) and the Screen max width (960 px,
  centered) were kept; the Dashboard is two columns at ≥ 900 px and stacked below (tested at 375 and 1280 px).

## Stage 15 — Final review and E2E

- **E2E test.** `src/e2e/spec-flow.test.tsx` runs the whole SPEC §13 flow through the real root
  layout (onboarding gate, app shell, stack and tabs) and every real route, with the store over
  in-memory repositories (the SQLite opener is mocked, as in `root-layout.test.tsx`) and a fixed
  repository clock. Session 4 is Deadlift / Sheiko #29 day 2, the reference configuration of Stage 9.
  Expected values are hand-computed in the file header (75 / 85 / 95 kg; Smolov Jr. 70 / 72.5 / 75;
  Sheiko week 1 tonnage 7,065 kg · 55 reps; logged tonnage 1,150 vs 1,125 kg; RTS e1RM 80 / 0.837 =
  95.6 kg; after Bench 105: 78.75 → 77.5, 89.25 → 90, 99.75 → 100; Progress improvement −4.4 kg /
  −4.4 %). The language switch checks Settings, History, Periodization, Progress, Dashboard and the
  logged session in pt-BR (`75,0 kg`, `78,75 kg → 77,5 kg`) and back to English. The test lives in
  `src/e2e/` (not in `src/app/`, which holds routes only).
- **Review of the math and the program data.** Re-read rounding (integer micrograms, ties down),
  load generation (`1RM × % + addKg`, `times` multiplier), volume aggregation, RIR ↔ RPE, the three
  e1RM formulas (integer forms re-derived: Epley `centi × (60 + 2n) / 600`, Brzycki
  `centi × 72 / (10 × (74 − 2n))`, RTS `centi × 100 / tenths-of-%`), validity and the
  representative-set rule, `compareE1rm`, stats and history. Spot-checked the RTS chart diagonal, the
  Smolov tables, Smolov Jr. and Sheiko #29 day 2 against the sources recorded in stages 7–11; no
  transcription discrepancy found (the independent audits of those stages stand).
- **Bugs found and fixed (each with a failing test first):**
  1. Progress read the store's newest-first 1RM and e1RM lists as if oldest first. `progressStats`
     sorts stably, so records sharing an instant kept the reversed order: the card showed the older
     reference 1RM and swapped latest / previous e1RM (the E2E flow, with a fixed clock, exposed it).
     The screen now passes both lists oldest first (`progress-screen.test.tsx`, E2E step 6).
  2. The exact load was shortened to two decimals, so 113.24 × 85 % = 96.254 read
     "96.25 kg → 97.5 kg", which looks like a tie rounded up (SPEC §5: ties round down). The exact
     load is now shown with up to six decimals, the generator's microgram scale
     (`periodization-table.test.tsx`). Rounded loads keep the 1–2 decimal format.
  3. With "All", a first e1RM minutes after the onboarding 1RM gave a time axis of minutes and three
     identical tick dates. A span under two days is now widened to one day each side of its centre
     (`chart-scale.test.ts`; the single-instant rule is the zero-span case).
  4. The chart's `kg` unit label overlapped the top tick label (found on the screenshots); the plot's
     top padding now leaves a line for it (`line-chart.test.tsx`).
- **Observed, not changed.** The slot editor sends the whole slot on every change, so two edits of
  the same slot faster than a store round trip (seen only with scripted clicks) can let the second
  overwrite the first. `validateRirRpe` rejects RIR 5 ("5+") with an RPE below 5, although SPEC §7
  allows RPE ≤ 5 for RIR 5+; the form never produces that pair (editing one field rewrites the
  other). Both are candidates for a later fix.
- **expo-doctor** (`npx expo-doctor`, expo-doctor 1.21.6): 20/20 checks passed; nothing to fix.
- **README.** "Planned features" and the stage-by-stage status were replaced by the implemented
  feature list, a status line, screenshots (`docs/images/`, taken from `npx expo start --web` with
  Playwright, Chromium, 390 × 844 and 1280 × 800 at device scale factor 2, SPEC §13 data) and a
  Limitations section (partial / unverified program data and why, Smolov Jr. single range and
  week 3 = 2 × increment, Smolov switching phase and disputed sets, Sheiko #32 max attempts and
  shipped routines, RTS 12 @ RPE 6, e1RM validity, no session deletion, local-only data).

## Stage 16 — CI pipeline + Android APK build

- **CI** (`.github/workflows/ci.yml`, pull requests and pushes to `main`): Node from `.nvmrc` (`22`;
  the suite needs `node:sqlite`, Node ≥ 22.13), `npm ci`, `npx expo lint`, `npx tsc --noEmit`,
  `npm test -- --coverage`; a second job runs `shellcheck scripts/*.sh` and `actionlint` (Docker image
  `rhysd/actionlint:1.7.7`). `permissions: contents: read`, concurrency cancels superseded runs.
  Third-party actions are pinned to major tags (`actions/checkout@v4`, `setup-node@v4`, `cache@v4`,
  `upload-artifact@v4`, `download-artifact@v4`, `docker/setup-buildx-action@v3`,
  `docker/build-push-action@v6`).
- **Toolchain (Expo SDK 58 / React Native 0.88.1).** Taken from the installed packages and the SDK 58
  docs (`https://docs.expo.dev/versions/v58.0.0/sdk/build-properties/`, `llms.txt`):
  `react-native/gradle/libs.versions.toml` (`compileSdk` 37, `targetSdk` 36, `minSdk` 24,
  `buildTools` 37.0.0, `ndkVersion` 27.1.12297006, AGP 9.2.1, Kotlin 2.2.0), the SDK template's
  Gradle wrapper (Gradle 9.4.1, needs JDK 17+; React Native compiles with `jvmToolchain(17)`),
  `ReactAndroid/build.gradle.kts` (CMake 3.30.5) and the `engines` of `expo` / `react-native`
  (Node `^22.13`). The image pins: JDK Temurin 17.0.19_10 (`eclipse-temurin:17.0.19_10-jdk-jammy`),
  Node 22.23.4 (tarball, SHA-256 verified), Android command-line tools 16111833 (SHA-1 verified),
  `platforms;android-37.0`, `build-tools;37.0.0`, `ndk;27.1.12297006`, `cmake;3.30.5`, `platform-tools`.
  Package names were checked against the live `repository2-3.xml` of the Android SDK. Gradle itself is
  downloaded by the wrapper at build time (cached).
- **Docker image** (`docker/android/Dockerfile`): non-root user `builder` (uid 1000); the SDK and home
  directory are world-writable so `--user "$(id -u):$(id -g)"` works with a bind-mounted workspace.
  No secrets in the image. The entry point runs `scripts/build-apk.sh` from the mounted workspace, so
  the image holds only the toolchain and never goes stale; its build context is `docker/android/` only.
- **`scripts/build-apk.sh`**: `npm ci`, `expo prebuild --platform android --clean --no-install`,
  `./gradlew assembleRelease --no-daemon` for `arm64-v8a,armeabi-v7a` (override with `CYCLE_ABIS`; the
  default of four ABIs makes the build slower and the APK larger), then `dist/cycle-<version>-<sha7>.apk`.
  `expo prebuild` rewrites the `android` / `ios` scripts of `package.json`; the script restores the file
  on exit.
- **Signing.** Config plugin `plugins/with-release-signing.js` (tested in
  `src/plugins/with-release-signing.test.ts`, also run against the real SDK 58 template with
  `expo prebuild`) adds a `release` signing config to the generated `app/build.gradle`, read from the
  Gradle properties `CYCLE_KEYSTORE_FILE`, `CYCLE_KEYSTORE_PASSWORD`, `CYCLE_KEY_ALIAS`,
  `CYCLE_KEY_PASSWORD`, and signs the release build with it only when `CYCLE_KEYSTORE_FILE` is set;
  otherwise the template's debug keystore stays. The script decodes `ANDROID_KEYSTORE_BASE64` to a
  temporary file outside the workspace, removed on exit, and passes the values as
  `ORG_GRADLE_PROJECT_*` environment variables (not on a command line). With all four secrets the file is
  `cycle-<version>-<sha7>.apk`, otherwise `cycle-<version>-<sha7>-unsigned-debugkey.apk`. The plugin
  fails prebuild if the template no longer has the anchors it patches, instead of silently shipping a
  debug-signed release.
- **APK workflow** (`android-apk.yml`): `push` to `main`, `workflow_dispatch`, and `pull_request` with
  the `build-apk` label (build and artifact only). Buildx with the GitHub Actions layer cache, Gradle and
  npm caches via `actions/cache` (host directories mounted into the container), artifact `cycle-apk`
  with 30-day retention. A separate `release` job (the only one with `contents: write`, never on pull
  requests) deletes and recreates the `latest-main` pre-release with `gh`, targeting the built commit, so
  the tag always points at the APK's commit. Because the file name contains the sha, the download URL of
  the asset changes with each build; the release page URL is stable.
- **Verification record.** Locally: the image builds (9.3 GB on disk) and `scripts/build-apk.sh` ran in it
  through `npm ci` and `expo prebuild` into the Gradle build; the full Gradle build did not finish because
  Maven Central answered HTTP 429 to the sandbox's shared egress address. `shellcheck` 0.10.0 and
  `actionlint` 1.7.7 (Docker images) report nothing; the signing plugin was also run through a real
  `expo prebuild` and produced the expected `app/build.gradle`. The Actions runs on `main` are the
  end-to-end check, and the APK was not installed on an emulator or device in this stage.

## 2026-11-11 — v2: pivot to a general weight-training app

- **Decision (owner request).** CYCLE changes from a powerlifting periodization manager to a general
  weight-training ("musculação") app: exercise library with custom exercises, importable plans,
  load/deload cycles, set/reps/load logbook and automatic load progression from history. New
  `docs/SPEC.md` (v2) and `docs/PLAN.md` (v2); the v1 documents moved to `docs/archive/`.
- **Replace, not extend.** The v1 model (three lifts, reference 1RMs, percentage programs, three-week
  generator, RTS e1RM history) is removed from the code instead of being kept next to the new model.
  Alternative considered: keep the percentage programs as a second kind of plan — rejected because it
  doubles the data model and the UI (two meanings of "periodization") for a feature the new product
  does not ask for. The v1 code stays in git history (last v1 commit `3774916`).
- **v1 user data is preserved.** Migrations 001–009 are immutable and the v1 tables are not dropped;
  migration 010 copies completed v1 sessions into the v2 logbook (SPEC §11.3).
- **Training-driven weeks.** A cycle week is `sessionsPerWeek` completed plan sessions, not a calendar
  week, so a missed day never burns a week of the cycle and A/B/C rotations work at any frequency.
  Alternative: calendar weeks anchored to a start date — rejected because skipped weeks would trigger
  a deload nobody trained for.
- **Progression model.** Double progression inside the plan's rep range (SPEC §6): increase the load
  when every set reaches the top of the range, add reps otherwise, reduce after two sessions below the
  range. Deterministic rules with reason codes so every suggestion can be explained in the UI.
  The cycle lengths per experience level, the stall rule and the deload factors are app-defined,
  editable heuristics, not transcriptions of a published method.
- **e1RM.** Only the RIR-adjusted Epley formula remains, computed on the fly from logged sets as a
  trend metric (no stored e1RM history, no formula setting).
- **Import formats.** A versioned JSON document (`cycle-plan` v1) and a plain-text format; exercise
  names are matched exactly after normalization and never guessed — unmatched names are resolved by
  the user in the import preview (pick an existing exercise or create a custom one).
- **Workflow.** Owner instruction for this migration: one integration branch
  (`claude/bodybuilding-training-app-lr6egj`), one PR to `main` at the end, squash merge. Stages are
  delegated to sub-agents (haiku/sonnet/opus by complexity, escalating on failure); independent stages
  run in parallel git worktrees and are merged by the orchestrator. Supersedes the 2026-11-05
  "Orchestration" entry (direct-to-main fallback) for this migration: GitHub PR tooling is available.
