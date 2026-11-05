# CYCLE — Functional and Technical Specification

> AI powerlifting periodization manager. This spec is the product's source of truth.
> The implementation plan lives in [`PLAN.md`](./PLAN.md) and the development rules in
> [`../AGENTS.md`](../AGENTS.md).

- **Status:** v1.1 (approved for implementation)
- **Platform:** Expo SDK 58 / React Native 0.88 / Expo Router (iOS, Android and Web)
- **Audience:** intermediate and advanced powerlifters
- **Languages:** project (code, docs, commits, PRs) in English; app UI bilingual —
  English (`en`) and Brazilian Portuguese (`pt-BR`). See §11.1.
- **Priorities (in order):** mathematical accuracy → fidelity to the original programs →
  session-configuration flexibility → long-term progression tracking

---

## 0. Glossary

| Term | Definition |
|---|---|
| **Lift** | One of the three main lifts: `bench` (Bench Press), `squat` (Squat), `deadlift` (Deadlift). |
| **Reference 1RM** | One-rep max entered by the user. Basis for all load calculations. Versioned (history). |
| **e1RM** | One-rep max *estimated* from an actual set (weight, reps, RIR). Always displayed as an estimate. |
| **Program template** | A program in the internal database (e.g. "Smolov Jr. — original"), with source, version and verification status. |
| **Program day** | A training day inside a template's original structure (e.g. Smolov Jr., week 1, day 3). |
| **Session slot** | A session configured by the user: `(order, lift, template, program day)`. |
| **Block** | The 3-week window of a program being viewed/generated. For programs longer than 3 weeks the user picks the block's starting week. |
| **Periodization** | Generated output: list of prescriptions per week × session, with calculated loads. |
| **RIR / RPE** | Reps in reserve / Rate of Perceived Exertion. Relationship: `RPE = 10 − RIR`. |

---

## 1. Core concept

The user **independently** configures each training session of the week by choosing:
exercise, program, session number and program week/block. The app automatically
generates a **complete three-week periodization** from these choices and the reference
1RMs.

- Programs and exercises can be freely mixed within the same week.
- Sessions can be added, removed, edited and reordered.
- Any change (exercise, program, session, 1RM, increment) **immediately recalculates**
  the periodization.

Example configuration (must be reproducible in an E2E test):

| Session | Exercise | Program |
|---|---|---|
| 1 | Bench Press | 5/3/1 (custom) |
| 2 | Bench Press | Smolov Jr. |
| 3 | Squat | 5/3/1 (custom) |
| 4 | Deadlift | Sheiko (selected template) |

### 1.1 Session ↔ program mapping

Each session slot points to **one program day** of the chosen template
(`programDayIndex`, 1-based within the program week). The custom 5/3/1 has a single
day per week. For Smolov Jr. the user picks which of the 4 weekly days the session
represents.

- The app **never changes** the program's original frequency. If the user's
  configuration does not cover every weekly day of the template (e.g. only 1 of Smolov
  Jr.'s 4 days), the app shows a **fidelity warning** ("This program prescribes 4
  sessions/week; your configuration uses 1") without blocking.
- Shortcut "Add all days of this program" creates the corresponding slots at once.

---

## 2. Initial 1RM registration

- Onboarding screen (first run) with editable kg fields for Bench, Squat and Deadlift.
- Validation: number > 0 and ≤ 600 kg, up to 2 decimal places. A lift may be left empty
  if it is not trained; the app prevents generating sessions for that lift until it is
  filled in.
- The user can update 1RMs at any time (Settings → 1RMs).
- **Every change creates a new versioned record** (`reference_1rm_history`: lift,
  value, effective date, origin = `manual | from_e1rm | onboarding`). Never overwrite.
- The periodization always uses the **current** reference 1RM; recorded sessions keep a
  *snapshot* of the 1RM and loads used at training time.

---

## 3. Training program database

### 3.1 Non-negotiable rules

1. **Never invent** sets, reps or percentages.
2. Never combine different variations without identifying them as distinct templates.
3. Preserve the original structure (duration, frequency, day order, progression).
4. Every template includes `source` (author, work/publication, URL when available,
   access date) and `version`.
5. Programs longer than 3 weeks are stored **in full**; the user views a 3-week block by
   choosing the starting week. Never compress.
6. Missing or unverified data is flagged explicitly
   (`verification: 'verified' | 'partial' | 'unverified'` on the template and
   `unverified: true` / `note` on the prescription). The UI shows an "Unverified data"
   badge and **does not calculate a load** for prescriptions without a confirmed
   percentage — it shows "—" plus the note.
7. Data lives in `src/programs/data/*.ts`, validated against the schema at test time (a
   test fails if any template violates the schema or omits `source`).
8. Program data is language-neutral. Human-readable labels/notes inside templates are
   stored in English (original terminology preserved) and may have optional `pt-BR`
   translations (`{ en: string; 'pt-BR'?: string }`).

### 3.2 Schema (TypeScript)

```ts
type Lift = 'bench' | 'squat' | 'deadlift';
type LocalizedText = { en: string; 'pt-BR'?: string };

interface ProgramTemplate {
  id: string;                 // 'cycle-531-custom', 'smolov-jr', 'smolov', 'sheiko-29' …
  family: '531-custom' | 'smolov' | 'smolov-jr' | 'sheiko';
  name: string;
  version: string;            // e.g. 'original (S. Smolov) — transcription v1'
  source: { author: string; reference: string; url?: string; accessedAt: string; notes?: string };
  verification: 'verified' | 'partial' | 'unverified';
  durationWeeks: number;
  daysPerWeek: number;
  allowedLifts: Lift[];       // lifts the template may be applied to
  liftSelectable: boolean;    // true = user picks the lift (e.g. Smolov Jr.)
  configurable?: ConfigurableParam[]; // parameters the ORIGINAL leaves to the athlete (see 3.4)
  weeks: ProgramWeek[];
}

interface ProgramWeek { week: number; phase?: LocalizedText; days: ProgramDay[] }
interface ProgramDay  { day: number; label?: LocalizedText; items: PrescriptionItem[] }

type PrescriptionItem =
  | { kind: 'main'; lift: Lift | 'selected'; sets: SetPrescription[]; note?: LocalizedText }
  | { kind: 'accessory'; name: LocalizedText; text: LocalizedText; note?: LocalizedText }; // not calculated

interface SetPrescription {
  reps: number;
  percent?: number;           // fraction of 1RM (0.75) — absent => no calculation
  addKg?: ParamRef;           // absolute increment defined by the original (Smolov/Jr.)
  amrap?: boolean;
  repeat?: number;            // number of identical sets (6x6 => repeat: 6)
  unverified?: boolean;
  note?: LocalizedText;
}
```

### 3.3 Templates

**A. 5/3/1 — custom user version** (`cycle-531-custom`, `verification: 'verified'`,
source = the user's definition in this spec). **This is not Wendler's 5/3/1** — do not
use Wendler's percentages, AMRAP sets or deload.

| Week | Sets | Reps | Default % |
|---|---|---|---|
| 1 | 3 | 5 | 75% |
| 2 | 3 | 3 | 85% |
| 3 | 3 | 1 | 95% |

- Exactly 3 working sets in every week.
- Per-week percentage configurable by the user (per profile; range 30–105%,
  step 0.5%). Defaults 75/85/95. Lift selectable.

**B. Smolov (original, squat)** (`smolov`). Full program (~13 weeks: introductory
microcycle, base mesocycle, switching phase, intense mesocycle and taper/test). Must be
transcribed in full from an identified primary/consolidated source, including frequency
(up to 4x/week), sets, reps, percentages and absolute increments. Lift fixed: squat.

**C. Smolov Jr.** (`smolov-jr`). 3 weeks, 4 days/week (6×6 @70%, 7×5 @75%,
8×4 @80%, 10×3 @85% in week 1, with absolute increments in weeks 2 and 3 per the
original). Lift selectable. The increments (the range recommended by the original,
which differs between upper- and lower-body lifts) are `configurable` — the user picks a
value **within the original range**; values outside it are rejected.

**D. Sheiko** (`sheiko-*`). Multiple original templates (e.g. the widely circulated
numbered routines such as #29, #30, #31, #32, #37, #39 — the final list depends on source
verification). Each template is its own record with its number/name, source, duration
and days. Accessory items are `kind: 'accessory'` (displayed, not calculated).
Percentages refer to the competition 1RM of the corresponding lift.

> The numeric values for Smolov, Smolov Jr. and Sheiko are intentionally **not**
> defined in this spec: they must be transcribed from an identified source by the
> corresponding implementation stage (see PLAN), with data "snapshot" tests and the
> `source` field filled in. The numbers quoted above are sanity checks only.

### 3.4 Configurable parameters

Only parameters the original program itself leaves to the athlete (e.g. Smolov Jr.'s
weekly increment) or that this spec defines as configurable (custom 5/3/1 percentages).
Each parameter has `min`, `max`, `default` and `source`.

### 3.5 "Programs" screen

List of templates with name, version, source, duration, frequency and verification
badge. The detail view shows the full structure week by week (percentages and reps),
without load calculations, and allows browsing the entire original program.

---

## 4. Automatic periodization generator (central feature)

### 4.1 Configuration interface

Reorderable list of session slots. For each slot:
1. Exercise (lift)
2. Program (template; filtered by `allowedLifts`)
3. Program day (when `daysPerWeek > 1`)
4. Block starting week (when `durationWeeks > 3`; default 1; max
   `durationWeeks − 2`; partial blocks at the end of the program show only the existing
   weeks)
5. Template configurable parameters, if any

Actions: add, duplicate, remove, reorder (accessible ↑/↓ buttons + drag where
supported), "Generate periodization". Generation is also reactive: any edit updates the
output instantly (pure, synchronous computation, < 50 ms for 10 slots).

### 4.2 Output

For each `(block week 1..3) × (slot)`, a `GeneratedSession` with:

- block week and original program week
- session number (slot order)
- lift, program name + version, program day
- list of sets: reps, % of 1RM, calculated load (kg, exact), rounded load (kg)
- accessory items (text)
- **total volume**: tonnage `Σ reps × rounded load` (kg) and total rep count; also
  aggregated per week and per lift
- warnings (unverified data, incomplete frequency, missing 1RM)

### 4.3 Load calculation

```
exactKg   = reference1RM[lift] × percent  (+ Σ cumulative addKg, when the original defines it)
roundedKg = round(exactKg, increment)      // see §5
```

Computed in `src/domain/` (pure, deterministic, no I/O), with unit tests. Use arithmetic
that avoids floating-point error (work in integer grams, or round the final result to 3
decimals before display).

### 4.4 Persistence

The configuration (slots) is saved per profile. A generated periodization can be
"activated" (saved with a start date), which freezes a snapshot used by the calendar and
the tracker; regenerating with another configuration creates a new periodization without
deleting the previous one.

---

## 5. Load increments and rounding

- Options: 1, 1.25, 1.5, 2, 2.5 kg; custom (0.1–25 kg, step 0.05). Default: 2.5 kg.
- Profile-wide setting (optional per-lift override).
- Rounding mode: **nearest** (default; ties round down, so a load is never prescribed
  above the percentage), with "always down" and "always up" options.
- Always display the original calculated load and the rounded practical load
  (e.g. `96.25 → 95.0 kg`).
- Mandatory edge-case tests: exact multiples, ties, decimal increments (1.25, 1.5),
  large values, result never negative.

---

## 6. Training dashboard and visualization

- **View A — Three-week table:** rows = sessions (slots), columns = weeks 1–3,
  cell = sets×reps @ % → rounded kg. On narrow screens, horizontal scroll with a pinned
  first column, or a per-week toggle; on wide screens, the 3 weeks side by side.
- **View B — Calendar:** week × session grid; each card shows lift, program and a set
  summary; tapping opens `/session/[id]` with the detailed prescription (and access to
  performance logging).
- Both views read from the **same** data source (store/selector) — synchronized by
  construction. A test guarantees that changing a slot is reflected in both.

---

## 7. Actual training performance tracker

For each working set of a generated session:

| Field | Rule |
|---|---|
| Actual weight (kg) | required, > 0, pre-filled with the prescribed rounded load |
| Reps completed | required, integer ≥ 0 (0 = failure) |
| RIR | integer 0–10; `5+` accepted |
| RPE | optional, 1–10 in 0.5 steps; auto-filled from RIR |
| Notes | optional, text ≤ 500 chars (per set and per session) |

RIR ↔ RPE relationship (`src/domain/rpe.ts`):

| RIR | Approx. RPE |
|---|---|
| 0 | 10 |
| 1 | 9 |
| 2 | 8 |
| 3 | 7 |
| 4 | 6 |
| 5+ | ≤ 5 |

- `RPE = 10 − RIR` (for RIR ≥ 5, RPE ≤ 5). If the user edits RPE, RIR becomes
  `10 − RPE` (half points allowed, e.g. RPE 8.5 → RIR 1.5).
- If both are entered and differ by more than 0.5, show a validation error.
- Extra (non-prescribed) sets can be added and are flagged `extra`.
- Prescribed vs. actual comparison per set (Δ kg, Δ reps) and per session (Δ tonnage).
- Immediate local save (draft) and "Complete session", which records the date and a
  snapshot.

---

## 8. Automatic estimated 1RM calculator (critical feature)

### 8.1 Formulas (all account for RIR)

Let `w` = weight, `r` = reps completed, `RIR` = reps in reserve,
`n = r + RIR` (estimated reps to failure).

| ID | Name | Formula | Source |
|---|---|---|---|
| `rts` (**default**) | Tuchscherer RPE chart (Reactive Training Systems) | `e1RM = w / pct(r, RPE)` with `pct` from the RTS chart (reps 1–12 × RPE 6–10, half points interpolated) | M. Tuchscherer, *The Reactive Training Manual* (2008) |
| `epley-rir` | RIR-adjusted Epley | `e1RM = w × (1 + n/30)`; if `n = 1`, `e1RM = w` | Epley (1985) + RIR adjustment (Zourdos et al., 2016) |
| `brzycki-rir` | RIR-adjusted Brzycki | `e1RM = w × 36 / (37 − n)` | Brzycki (1993) + RIR adjustment |

The RTS chart must be transcribed from an identified source into
`src/domain/e1rm/rts-table.ts` with `source`. The user chooses the formula in Settings;
the formula used is stored with every estimate (recomputing history with a different
formula is a view, not a rewrite).

**Acceptance example** (Bench, 80 kg × 5 @ RIR 1 / RPE 9):
- `epley-rir`: 80 × (1 + 6/30) = **96.0 kg**
- `brzycki-rir`: 80 × 36/31 = **92.9 kg**
- `rts`: 80 / pct(5 reps, RPE 9) — expected value taken from the transcribed chart
  (≈ 95–96 kg; the test must use the chart's exact value).

### 8.2 Validity

A set is **valid for e1RM** if: `r ≥ 1`, `RIR ≤ 4` (RPE ≥ 6) and `n ≤ 12`
(or the chart's limit). Sets outside that range show a "low confidence" e1RM and are not
added to history. Sets without RIR/RPE produce no e1RM.

### 8.3 Representative session estimate

A session produces **at most one e1RM per lift**, never one per set:

1. Filter the lift's valid sets.
2. Pick the set with the smallest `n` (closest to a maximal effort → least
   extrapolation).
3. Tie → heaviest weight; next tie → lowest RIR; next tie → first set.
4. Session e1RM = that set's e1RM. Per-set e1RMs are displayed for information only.

### 8.4 Display and history

- Show the e1RM immediately after a valid set is completed and in the session summary,
  always labeled as an estimate (e.g. "e1RM ≈ 96 kg (estimate)").
- Compare with the previous e1RM for the same lift (Δ kg and Δ %).
- History `e1rm_history` (lift, date, value, formula, source set, session).
- Action "Use as new reference 1RM" → creates a `reference_1rm_history` record with
  origin `from_e1rm` (explicit confirmation; never automatic).

---

## 9. Strength progression dashboard

Per lift (Bench, Squat, Deadlift), cards showing:

- current reference 1RM
- latest e1RM, previous e1RM, highest e1RM
- absolute (kg) and percentage improvement: `latest e1RM − baseline`, where baseline =
  the reference 1RM in effect at the start of the selected period (default: first record)
- historical chart (e1RM line + reference-1RM steps), one per lift, with period filter
  (4 weeks, 3 months, 6 months, 1 year, all)
- interactive: tap/hover on a point shows date, value and originating session

Charts built with `react-native-svg` (installed via `npx expo install`) and in-house
components — lightweight, no unnecessary animation.

---

## 10. Training history

- List of completed sessions (newest first), filterable by lift, program and period.
- Each item: date, lift, program (+ version), session, prescribed sets×reps, actual
  weights/reps, RIR/RPE, e1RM.
- The detail view allows comparison with previous sessions of the same
  lift/program/day.
- Historical data is **immutable** with respect to later changes to programs,
  configuration or 1RMs (snapshots). Editing a past session is allowed but only
  recomputes that session's e1RM.

---

## 11. Design and UX

- Name: **CYCLE**. Dark theme by default (light option in Settings).
- Palette: background `#000000` / charcoal `#121212`, `#1C1C1E`; text `#FFFFFF` /
  secondary `#A1A1AA`; subtle red accent `#D32F2F` (restricted use: primary action, PR
  highlight, selection); borders `#2A2A2A`.
- Typography with strong hierarchy; tabular numbers (`fontVariant: ['tabular-nums']`).
- No decorative animation; standard native transitions only.
- Responsive: mobile (tabs) and wide desktop/web (sidebar). Breakpoint ≥ 900 px.
- Navigation:
  - Mobile (5 tabs): **Dashboard**, **Periodization** (Table | Calendar),
    **Training** (performance logging), **Progress**, **More** (Programs, History,
    Settings).
  - Web/desktop: sidebar with Dashboard, Periodization, Programs, Calendar, Training,
    Progress, History, Settings.
- Accessibility: touch targets ≥ 44 pt, `accessibilityLabel` on controls, AA contrast
  (labels are localized too).

### 11.1 Internationalization (bilingual app)

- Supported UI languages: **English (`en`)** and **Brazilian Portuguese (`pt-BR`)**.
- Default: device locale (via `expo-localization`) — `pt*` → `pt-BR`, anything else →
  `en`. The user can override it in Settings (System / English / Português); the choice
  is persisted per profile and applies instantly without restart.
- All user-facing strings live in translation catalogs `src/i18n/locales/en.ts` and
  `src/i18n/locales/pt-BR.ts`. `en` is the source catalog; the `pt-BR` catalog is typed
  against it so a missing key is a **type error**. No hard-coded UI strings in
  components (enforced by review and by a test that compares catalog keys).
- Lightweight in-house `t(key, params)` with interpolation and pluralization (or a
  well-supported library if justified in `docs/DECISIONS.md`).
- Number and date formatting is locale-aware (`Intl.NumberFormat` / `Intl.DateTimeFormat`):
  `96.25 kg` in `en`, `96,25 kg` in `pt-BR`. Numeric inputs accept the locale's decimal
  separator (and also `.` in `pt-BR`). Units are always kg.
- Lift and program names: canonical English names (Bench Press, Squat, Deadlift,
  Smolov, Sheiko) with localized display labels (e.g. Supino, Agachamento, Levantamento
  Terra) where applicable; program names themselves are not translated.
- Validation and warning messages are localized; domain code returns error **codes**,
  never display strings.

---

## 12. Technical requirements

### 12.1 Layered architecture (mandatory separation)

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

- `domain/` and `programs/` do not import React, Expo, `data/` or `i18n/`.
- `data/` exposes repository interfaces; tests use an in-memory implementation.
- No random or "mock" values in production code.

### 12.2 Persistence

- `expo-sqlite` (check the SDK 58 API in the docs before using it).
- Versioned migrations (`src/data/migrations/NNN_*.ts`), run at boot.
- Minimum tables: `profiles`, `reference_1rm_history`, `settings`, `session_slots`,
  `periodizations`, `generated_sessions` (JSON snapshot), `performed_sessions`,
  `performed_sets`, `e1rm_history`.
- Local user profiles (multiple profiles per device; selector in Settings). All data is
  scoped by `profile_id`.
- Web: use expo-sqlite's web support per the SDK docs; if unavailable, an alternative
  adapter behind the same repository interface.

### 12.3 Quality

- TDD (see AGENTS.md). Minimum coverage: `domain/` and `programs/` ≥ 95% lines;
  global ≥ 80%.
- Jest with the `jest-expo` preset + `@testing-library/react-native`.
- CI (GitHub Actions) on every PR: `npm ci`, `npx expo lint`, `npx tsc --noEmit`,
  `npm test -- --coverage`.
- Input validation on every form (clear, localized messages).
- UI tests run in both locales for screens with formatted numbers.

### 12.4 Build and distribution

- An Android APK is built automatically from every push to `main` by a GitHub Actions
  workflow that runs the build **inside a Docker container** (reproducible toolchain:
  JDK, Android SDK/NDK, Node). Native projects are generated in the container with
  `npx expo prebuild` (CNG) — never committed.
- The APK is published as a workflow artifact and attached to a rolling `latest-main`
  pre-release. Release signing uses repository secrets when present; otherwise the
  build is debug-key signed and labeled as such.
- The same Docker image/script can build the APK locally. EAS Build remains a
  supported alternative.
- The project `README.md` explains what CYCLE is, how to run it and how to build the APK.

### 12.5 Reactivity

Changing exercise, program, session, 1RM, increment, configurable parameters or language
must automatically update the visible periodization (memoized selectors derived from
state; no manual recalculation in each screen).

---

## 13. Target acceptance flow (E2E)

1. Open the app → onboarding → enter 1RMs (Bench 100, Squat 140, Deadlift 180).
2. Periodization → Session 1: Bench / custom 5/3/1; Session 2: Bench / Smolov Jr. day 1;
   Session 3: Squat / 5/3/1; Session 4: Deadlift / Sheiko (template X, day Y).
3. View the three-week table: Session 1 week 1 = 3×5 @75% → 75.0 kg; week 2 = 3×3
   @85% → 85.0 kg; week 3 = 3×1 @95% → 95.0 kg (2.5 kg increment).
4. Switch to the calendar → open Session 1 / week 1 → log 3 sets
   (80 kg × 5 @ RIR 1 on the last one).
5. Complete → the estimated e1RM is displayed and stored; Progress shows the point on
   the Bench chart; History lists the session.
6. Change Bench 1RM to 105 → the periodization recalculates; the completed session stays
   unchanged.
7. Switch language to Português → all screens render in pt-BR with `75,0 kg`-style
   formatting; switch back to English.

---

## 14. Out of scope (v1)

Cloud sync/remote accounts, social features, LLM-generated programs, load calculation
for accessory exercises, lb conversion (can be added later; all logic uses kg),
languages other than English and Brazilian Portuguese.
