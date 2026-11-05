# CYCLE

AI powerlifting periodization manager for the bench press, squat and deadlift.

## What is CYCLE

CYCLE helps intermediate and advanced powerlifters plan training periods and track how
their strength changes over time. It is a mobile-first app for iOS, Android and the web,
built with Expo.

Planned features (see [`docs/SPEC.md`](docs/SPEC.md) for the full specification):

- Reference 1RMs per lift, with history and multiple profiles per device.
- Automatic periodization generator with a three-week table and a calendar view.
- Program database: custom 5/3/1, Smolov Jr., Smolov and Sheiko. Values are transcribed
  from cited sources; anything that cannot be verified is marked `unverified` and produces
  no load.
- Load increments and rounding rules.
- Session logging with RIR/RPE, prescribed vs. actual comparison.
- Estimated 1RM (e1RM) per session, with the RTS chart as default formula.
- Strength progression dashboard with e1RM / reference 1RM charts and a period filter.
- Training history (planned).
- Bilingual interface: English and Brazilian Portuguese.

**Status:** under development. The foundation is in place (Stage 1): test infrastructure,
CYCLE dark theme and base components, bilingual i18n layer, five-tab navigation (sidebar on
wide screens) with placeholder screens, and local SQLite persistence with migrations and a
default profile. Stage 2 adds profiles and reference 1RMs: a first-run onboarding for the
Bench, Squat and Deadlift 1RMs, and Settings (More → Settings) to switch, create and
rename profiles, edit the 1RMs (every change appends a record; the history is shown per
lift) and choose the language (System / English / Português). Stage 3 adds load increments
and rounding to Settings: the rounding mode, the default increment (a preset or a custom
value), a per-lift increment override, and a live example (`96.25 kg → 95.0 kg`). Stage 4
adds the program database and the Programs screen (More → Programs): each template with
its version, source, duration, frequency and verification badge, and a detail view with the
full original structure week by week. The first template is the custom 5/3/1 (3 sets of
5 / 3 / 1 reps at 75 / 85 / 95 % by default); its three percentages can be edited per
profile (30–105 % in 0.5 % steps). Stage 5 adds the periodization generator (Periodization
tab): build the week's sessions (add, duplicate, remove, reorder with ↑/↓; choose the lift,
the program, the program day and the block's starting week), and the three-week table shows
every set as `sets × reps @ %` with the exact and the rounded load (`119.0 kg → 120.0 kg`),
volume (tonnage and reps) per session, week and lift, and warnings (missing 1RM, incomplete
program frequency, unverified data, invalid sessions). Any change to sessions, 1RMs, increments
or program percentages updates the table immediately. "Activate periodization" saves a
snapshot with a start date; later edits do not change it. Stage 6 adds a Table | Calendar toggle to
the Periodization tab: the calendar is a week × session grid of cards (lift, program and a set
summary with the rounded load), and tapping a card opens the session detail (`/session/[id]`) with
every set (`exact → rounded` load), volume, accessories, warnings and the program's version and
source. Both views read the same selector, so they always agree. Stage 7 adds Smolov Jr. for the
bench press or the squat: four days a week for three weeks (6 × 6 @ 70 %, 7 × 5 @ 75 %, 8 × 4 @ 80 %,
10 × 3 @ 85 %), with a weekly increment added in week 2 and twice in week 3. The increment is chosen
per profile inside the range of the sources (2.5–5 kg, default 2.5 kg) from the session editor or the
program detail; other values are rejected. "Add all days of this program" creates the missing
program days at once, and a warning shows while a configuration covers fewer days than the program
prescribes. Stage 8 adds the full Smolov squat program (13 weeks: introductory microcycle, base
mesocycle with fixed +10 kg / +15 kg increments and a 1RM test, switching phase, intense mesocycle,
taper and test). The session editor's block start week browses any three-week block (weeks 1–11);
weeks with three sessions show a rest day in the fourth day slot, 1RM tests are shown as text, and
the switching phase and two sets on which the sources disagree are flagged "Unverified data" with no
load. Stage 9 adds five numbered Sheiko routines (#29, #30, #31, #32 and #37: one month each, three
days a week, squat, bench press and deadlift work on the same days), transcribed from Lift Vault's
spreadsheet collection and checked set by set against a second transcription. The session editor
lists Sheiko once among the programs, with a second selector for the routine, and the Programs screen
groups the routines under "Sheiko". On these multi-lift days only the session's lift is calculated;
the day's other lifts are shown as information without loads, and a warning appears when the chosen
day has no work for the session's lift. Variations such as "Deadlift from boxes" use the competition
lift's 1RM, accessories are listed with sets and reps only, and the #32 max attempts (the sources give
2–3 singles at 100–105%) are flagged "Unverified data" with no load. Stage 10 adds performance
tracking: from a live session in the calendar, "Log this session" opens the matching session of the
**activated** periodization (`/session/p<periodizationId>-<slotId>-w<week>`), where each prescribed
set has weight (pre-filled with the prescribed load), reps, RIR, RPE (kept in sync as RPE = 10 − RIR,
half points allowed; `5+` is accepted as RIR) and notes, plus extra sets and session notes. Every
change is saved as a draft at once; "Complete session" records the date and a snapshot of the
prescription and the 1RM, shows prescribed vs. actual per set (Δ kg, Δ reps) and per session (Δ
tonnage) and makes the session read-only. The Training tab lists the sessions in progress and the
next pending session. Stage 11 adds the estimated 1RM: as soon as a logged set has weight, reps and
RIR/RPE it shows its e1RM (`e1RM ≈ 95.6 kg (estimate)`), or "low confidence" when RIR is above 4 or
the set is more than 12 reps from failure, and the session card shows one estimate per lift from its
representative set (the fewest reps to failure; ties go to the heaviest weight, then the lowest RIR,
then the first set) with Δ kg and Δ % against the previous e1RM. Completing the session stores that
estimate with the formula used; the summary offers "Use as new reference 1RM", which after a
confirmation adds a 1RM record with origin "From e1RM". The formula is chosen in Settings: the RTS
chart (default; the widely circulated Tuchscherer chart, whose only disputed cell, 12 reps @ RPE 6,
is unverified and gives no estimate), Epley (RIR) or Brzycki (RIR); changing it never rewrites stored estimates. Stage 12 fills the Progress tab (SPEC §9): per lift
(Bench, Squat, Deadlift) it shows the current reference 1RM, the latest, previous and highest e1RM and
the improvement (Δ kg and Δ %) of the latest e1RM over the baseline, which is the reference 1RM in
effect at the start of the selected period (the first record for "All"), plus a chart of the e1RM line
and the reference 1RM as steps. A period filter (4 weeks, 3 months, 6 months, 1 year, All) limits the
chart and sets the baseline; tapping or hovering a point shows its date, value and originating
session. Lifts without an e1RM show an empty state. Features
are built stage by stage; the current state of each stage is in the status table of
[`docs/PLAN.md`](docs/PLAN.md).

## Tech stack and architecture

- Expo SDK 58, React Native 0.88, TypeScript.
- Expo Router for navigation: every file in `src/app/` is a screen, `_layout.tsx` files
  define navigators. Mobile uses five bottom tabs (Dashboard, Periodization, Training,
  Progress, More); at window widths ≥ 900 px the tab bar becomes a sidebar.
- `expo-sqlite` for local persistence (native and web), behind repository interfaces.
- `expo-localization` for device locale detection; in-house `t()` for translations.
- `zustand` for app state (stores created per app run, consumed through selectors).
- `jest-expo` + `@testing-library/react-native` for tests.
- `react-native-svg` for the in-house progress charts (no charting library).

Layers (from [SPEC §12.1](docs/SPEC.md#121-layered-architecture-mandatory-separation)):

```
src/
  domain/      # pure math engine: rounding, loads, periodization, rpe, e1rm, stats
  programs/    # program database: schema, data/*.ts, validation, block selection
  data/        # persistence: expo-sqlite, migrations, repositories (interfaces + impl)
  state/       # stores/hooks connecting data ↔ domain ↔ UI
  components/  # reusable UI (tables, cards, charts, numeric inputs)
  i18n/        # translation catalogs, t(), locale detection, formatters
  app/         # Expo Router routes (screens and layouts only)
```

Reference 1RMs (SPEC §2) are validated in `src/domain/validation.ts` (> 0 and ≤ 600 kg, up
to 2 decimals) and stored append-only in `reference_1rm_history`: the repository only adds
records, and the current value is the latest by effective date. Data is scoped by profile;
the active profile is remembered across launches.

Load increments and rounding (SPEC §5) live in `src/domain/rounding.ts`. `roundLoad(kg,
increment, mode)` works in integer micrograms, so ties and exact multiples are decided
without floating-point error. The modes are `nearest` (the default; a tie rounds down, so a
load is never prescribed above its percentage), `down` and `up`. The default increment is
2.5 kg, a preset (1, 1.25, 1.5, 2 or 2.5 kg) or a custom value (0.1–25 kg in 0.05 steps).
Each lift can override the default increment. The settings are stored per profile in
`rounding_settings` and `lift_increment_overrides`.

Program templates (SPEC §3) live in `src/programs/`: the schema (`schema.ts`), one file per
template in `data/`, `validate.ts` (a test validates every registered template and fails if
one omits its source or version), the `registry.ts` (list, find by id, filter by lift),
`blocks.ts` (`getBlock(template, startWeek)`: three consecutive weeks, never compressed,
fewer at the end of the program) and `params.ts` (configurable parameters such as the 5/3/1
percentages, with their allowed range). Parameter values chosen by the athlete are stored
per profile in `program_params`; the template defaults apply until one is saved. Templates so far:
the custom 5/3/1 (`data/cycle-531-custom.ts`), Smolov Jr. (`data/smolov-jr.ts`), Smolov
(`data/smolov.ts`) and the Sheiko routines #29, #30, #31, #32 and #37 (`data/sheiko-<number>.ts`), all
but the first transcribed from the sources listed in `docs/DECISIONS.md` (verification `partial`).
A main item may name a variation of its lift (`exercise`), an informational item may belong to one
lift (`lift`), and templates of one family carry a short `variant` label (`#29`). Besides sets, a program day can hold informational items
(`kind: 'info'`: rest days, max tests, loosely described phases), and an absolute increment can be a
parameter (`addKg: { param, times }`) or fixed by the original (`addKg: { kg }`).

The periodization generator (SPEC §4) is `generatePeriodization(slots, templates, 1RMs,
rounding, params)` in `src/domain/periodization.ts`: pure and synchronous (a test checks that 10 sessions take
less than 50 ms), computing `1RM × percent (+ addKg)` in integer micrograms and rounding with
`roundLoad`. Sets without a confirmed percentage, or whose lift has no 1RM, get no load ("—").
On days that train several lifts (Sheiko), only the slot's lift is calculated; the other lifts' items
are returned as `otherItems` (information, no load or volume).
Warnings are codes that the UI translates. The store exposes it through the memoized
`selectPeriodization` (`src/state/periodization-selectors.ts`). Session slots are stored per
profile in `session_slots`; activated periodizations in `periodizations` (configuration
snapshot) and `generated_sessions` (one JSON snapshot per session). The session detail route
(`/session/<slotId>-w<blockWeek>`) shows a session of the live periodization;
`/session/p<periodizationId>-<slotId>-w<blockWeek>` shows a session of an activated snapshot and is
where performance is logged (SPEC §7). RIR ↔ RPE conversions and the logging rules (field validation,
prescribed-vs-actual, the completion snapshot) are pure code in `src/domain/rpe.ts` and
`src/domain/performance.ts`; drafts and completed sessions are stored in `performed_sessions` and
`performed_sets` (migration 007). The e1RM engine (SPEC §8) is pure code in `src/domain/e1rm/`:
`rts-table.ts` (the RTS RPE chart, reps 1–12 × RPE 10–6, transcribed with its sources; the one cell
the sources disagree on is `unverified`, and the later RTS TRAC table's differences are kept as a note), `estimate.ts` (`rts`: `w / pct(reps, RPE)`, `epley-rir`: `w × (1 + n/30)`,
`brzycki-rir`: `w × 36 / (37 − n)`, with `n = reps + RIR`, rounded to 0.1 kg; validity: at least one
rep, RIR ≤ 4, `n ≤ 12`) and `session.ts` (one estimate per lift from the representative set,
comparison with the previous one). Session estimates are stored in `e1rm_history` (migration 008),
and the formula for new estimates is a per-profile setting. The progression statistics (SPEC §9) are
pure code in `src/domain/stats.ts` (periods, current / latest / previous / highest, Δ kg and Δ % against
the baseline of the period) and the chart's scales, ticks and coordinates in `src/domain/chart-scale.ts`;
`src/components/progress/` only draws them.

Supporting folders: `src/constants/theme.ts` (design tokens) and `src/test-utils/`
(test-only helpers). Each layer has a `README.md` describing its contents and dependency
rules.

Dependency rules:

- `domain/` and `programs/` are pure TypeScript: they do not import React, Expo, `data/`
  or `i18n/`.
- `data/` exposes repository interfaces; tests use an in-memory implementation.
- `app/` contains only routes and layouts. Components, hooks and utilities live outside it.
- No random or mock values in production code.

## Running the app

Prerequisites: Node.js 22 (22.13 or later, for the test suite) with npm 10 (the version this project is developed with), and
either [Expo Go](https://expo.dev/go) on a phone or an iOS/Android simulator or emulator.
Native modules added in later stages may require a development build (see
[`AGENTS.md`](AGENTS.md)).

```bash
npm ci               # install exact dependencies from package-lock.json
npx expo start       # start the dev server; scan the QR code with Expo Go, or press a / i / w
npx expo start --web # open the app in the browser
npx expo lint        # lint
npx tsc --noEmit     # typecheck
npm test             # run the test suite
```

On the web, the database runs on SQLite compiled to WebAssembly. It needs cross-origin
isolation: `metro.config.js` adds the `Cross-Origin-Embedder-Policy: credentialless` and
`Cross-Origin-Opener-Policy: same-origin` headers in development, and any server that hosts
an exported web build must send the same headers. The web build is a single-page app
(`web.output: "single"`).

## Tests

Tests use Jest with the `jest-expo` preset and `@testing-library/react-native`. Test files
live next to the code they test (`*.test.ts` / `*.test.tsx` under `src/`).

```bash
npm test                          # run all tests once
npm run test:watch                # re-run on change
npm run test:coverage             # with coverage report and thresholds
npm test -- src/i18n              # only the tests under a path
```

Coverage thresholds (`jest.config.js`, SPEC §12.3): at least 80% of lines globally, and at
least 95% in `src/domain/` and `src/programs/` once those folders contain code.

Testing strategy:

- Pure logic (`src/domain/`, `src/programs/`) has unit tests with hand-computed expected
  values.
- Persistence: repositories are written against interfaces in `src/data/`. One behavioral
  contract suite runs against both the in-memory implementation and the SQLite
  implementation. In Jest, SQLite runs on Node's built-in `node:sqlite` module through
  `src/test-utils/node-sqlite.ts`, so tests need Node.js 22.13 or later. Migrations are
  tested on a real SQLite engine too.
- UI: behavior and accessible queries (no markup snapshots). Screens with formatted numbers
  are tested in both `en` and `pt-BR`.

The project follows test-driven development; see [`AGENTS.md`](AGENTS.md).

Add dependencies with `npx expo install <package>` (not `npm install`), so the versions match
the Expo SDK.

## Building the APK

The Docker-based Android APK pipeline (GitHub Actions + Docker) arrives in Stage 16.
Until then, build with EAS:

```bash
npx eas-cli@latest build -p android --profile preview
```

This requires an Expo account. The repository does not yet contain an `eas.json`, so run
`npx eas-cli@latest build:configure` first (or let the build command prompt you to set it up).

## Project documents

- [`docs/SPEC.md`](docs/SPEC.md): functional and technical specification (source of truth).
- [`docs/PLAN.md`](docs/PLAN.md): staged implementation plan and status table.
- [`docs/DECISIONS.md`](docs/DECISIONS.md): log of architecture and data-source decisions
  (append only).
- [`AGENTS.md`](AGENTS.md): development rules: TDD, Conventional Commits, branch and PR
  workflow, and Expo guidelines.

## Internationalization

The app is bilingual: English (`en`, the source catalog) and Brazilian Portuguese (`pt-BR`).
The language defaults to the device locale (`pt*` → Portuguese, anything else → English).
The per-profile `language` setting (`system`, `en` or `pt-BR`) overrides the device locale
and applies right away, without a restart. Choose it in More → Settings → Language.

### Adding a string

1. Add the key to `src/i18n/locales/en.ts` (the source catalog). Group keys by feature,
   for example `screens.training.title`.
2. Add the same key to `src/i18n/locales/pt-BR.ts`. The catalog is typed against `en`,
   so a missing or extra key fails `npx tsc --noEmit`, and `src/i18n/catalogs.test.ts`
   fails if the keys or `{{placeholders}}` differ between the two catalogs.
3. Use it in a component:

   ```tsx
   import { useT } from '@/i18n';

   const t = useT();
   <Text>{t('screens.training.title')}</Text>;
   ```

Placeholders use `{{name}}`: `t('validation.aboveMax', { max: 600 })`. Number params are
formatted for the locale (`1,500` / `1.500`). Plurals are objects with `one` and `other`
forms, selected by `params.count` (Portuguese treats 0 and 1 as singular):
`t('validation.tooManyDecimals', { count: 2 })`.

### Formatting numbers and dates

Use the formatters from `useI18n()`: `formatKg(96.25)` gives `96.25 kg` in English and
`96,25 kg` in Portuguese. There are also `formatNumber`, `formatPercent` and `formatDate`.
Numeric inputs (`NumberInput`) accept the locale's decimal separator, and in Portuguese
both `,` and `.`. Domain code returns error codes, and the UI turns them into localized
messages.

## License

Released under the MIT License. See [`LICENSE`](LICENSE).
