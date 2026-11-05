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
