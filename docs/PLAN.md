# CYCLE — Implementation Plan

> Implements [`SPEC.md`](./SPEC.md) following the rules in [`../AGENTS.md`](../AGENTS.md).
> Orchestration of this plan by an autonomous agent is described in
> [`ORCHESTRATOR_PROMPT.md`](./ORCHESTRATOR_PROMPT.md).

## How this plan works

- Work is split into **stages**. Each stage is executed by **one clean-context agent**
  (no memory of previous stages) of the indicated model family:
  - **haiku** — small, mechanical, tightly scoped tasks.
  - **sonnet** — UI + logic features with a clear scope.
  - **opus** — architecture decisions, critical math engine, research and faithful
    transcription of training programs, final review.
- **One feature at a time, closed end to end** (domain → persistence → state → UI →
  tests → README → PR merged into `main`) before the next starts. **A stage is done only
  when its PR is merged into `main`.** No stage begins before the previous one is merged.
- Each stage = **1 branch + 1 PR → `main`**, following the TDD workflow in AGENTS.md
  (or the direct-to-`main` squash fallback described there when a PR cannot be opened).
- **README:** created in Stage 0 and **updated by every stage** whose change affects it
  (new feature, new command, setup change). Stale README = stage not done.
- **CI and APK build come last** (Stage 16). Until then, `npm test`, `npx expo lint` and
  `npx tsc --noEmit` run locally before every merge and are the quality gate.
- **Every stage that adds UI adds its strings to both `en` and `pt-BR` catalogs**
  (SPEC §11.1). A stage is not done if any new string is missing a translation.
- At the end, the agent marks the stage as done in the status table below (within its
  PR) and records relevant decisions in `docs/DECISIONS.md`.

### Standard prompt to start a stage

```
You are the agent for Stage <N> of the CYCLE project. Read, in this order:
AGENTS.md, docs/SPEC.md, docs/PLAN.md (Stage <N> section), docs/DECISIONS.md and README.md.
Strictly follow the TDD and branch/PR workflow in AGENTS.md.
Implement only the scope of Stage <N>, and update README.md if your change affects it.
When done, open the PR to main and update the stage status in PLAN.md within the PR
(if a PR cannot be opened, use the direct-to-main fallback from AGENTS.md).
```

### Status

| Stage | Feature | Model | Branch | Status |
|---|---|---|---|---|
| 0 | Initial project README | haiku | `docs/00-readme` | ✅ |
| 1 | Foundation (tests, theme, navigation, i18n, DB) | opus | `feat/01-foundation` | ✅ |
| 2 | Profile + 1RM registration + 1RM history | sonnet | `feat/02-reference-1rm` | ⬜ |
| 3 | Increments and rounding | haiku | `feat/03-rounding` | ⬜ |
| 4 | Program database + custom 5/3/1 + Programs screen | sonnet | `feat/04-programs-531` | ⬜ |
| 5 | Periodization generator + three-week table | opus | `feat/05-periodization` | ⬜ |
| 6 | Calendar + session detail | sonnet | `feat/06-calendar` | ⬜ |
| 7 | Smolov Jr. | opus | `feat/07-smolov-jr` | ⬜ |
| 8 | Smolov (full program, block selection) | opus | `feat/08-smolov` | ⬜ |
| 9 | Sheiko (multiple templates) | opus | `feat/09-sheiko` | ⬜ |
| 10 | Performance tracking + RIR/RPE | sonnet | `feat/10-performance` | ⬜ |
| 11 | e1RM engine + session estimate | opus | `feat/11-e1rm` | ⬜ |
| 12 | Strength progression dashboard + charts | sonnet | `feat/12-progress` | ⬜ |
| 13 | Training history | sonnet | `feat/13-history` | ⬜ |
| 14 | Home dashboard + desktop responsiveness + i18n audit | sonnet | `feat/14-dashboard` | ⬜ |
| 15 | Final review and E2E | opus | `chore/15-final-review` | ⬜ |
| 16 | CI pipeline + Android APK build (GitHub Actions + Docker) | sonnet | `ci/16-ci-apk` | ⬜ |

Legend: ⬜ pending · 🟨 in progress · ✅ merged · ⚠️ merged with a recorded gap

---

## Stage 0 — Initial project README · **haiku**

**Goal:** a `README.md` (in English) that orients any human or agent from day one.
It describes the *target* product and marks what is not built yet; later stages keep it
current.

Sections:
1. **What is CYCLE** — purpose, audience, planned features (from SPEC), with a
   "Status" note pointing to the PLAN status table.
2. **Tech stack and architecture** — Expo SDK 58, Expo Router, expo-sqlite (planned),
   the layer diagram from SPEC §12.1 and its dependency rules.
3. **Running the app** — prerequisites (Node version from the environment, npm),
   `npm ci`, `npx expo start` (Expo Go, web), lint and typecheck. Tests: "added in
   Stage 1".
4. **Building the APK** — placeholder section: "Docker-based APK pipeline arrives in
   Stage 16"; meanwhile, EAS alternative (`npx eas-cli@latest build -p android
   --profile preview`).
5. **Project documents** — links to SPEC, PLAN, DECISIONS, AGENTS.md (TDD and
   branch/PR workflow).
6. **Internationalization** — the app is bilingual (en / pt-BR); details filled in by
   Stage 1.
7. **License.**

Verification: every command currently in the README runs as written; links resolve.
No tests needed (docs-only stage).

Acceptance: README merged into `main`.

---

## Stage 1 — Foundation · **opus**

**Goal:** the technical base every feature builds on. Opus because the decisions here
(layers, DB, testing, i18n) affect every stage.

Scope:
1. Read the versioned Expo SDK 58 docs (`https://docs.expo.dev/versions/v58.0.0/`) for
   `expo-sqlite`, `expo-localization`, Expo Router (tabs/stack) and `jest-expo`.
2. Test infrastructure: `jest-expo`, `@testing-library/react-native`, `npm test`
   script, coverage config with the SPEC §12.3 thresholds (applied to `src/domain` and
   `src/programs` from the start).
3. Remove the template's example screens (`explore`, unused demo components).
4. SPEC §12.1 folder structure with a short `README.md` in each layer describing its
   dependency rules.
5. CYCLE theme (SPEC §11): tokens in `src/constants/theme.ts`, dark by default; base
   components `Screen`, `Text`, `Card`, `Button`, `NumberInput` (locale-aware decimal
   separator, validation), `SegmentedControl`.
6. i18n (SPEC §11.1): `npx expo install expo-localization`; `src/i18n/` with `en` and
   `pt-BR` catalogs (pt-BR typed against en), `t()` with interpolation/plurals, locale
   detection + override, `formatNumber`/`formatKg`/`formatDate`, `I18nProvider` +
   `useT()` hook; a test that fails if catalog keys differ.
7. Navigation: mobile tabs (Dashboard, Periodization, Training, Progress, More) with
   minimal working placeholder screens; web layout with a sidebar at width ≥ 900 px.
   All labels localized.
8. Persistence: `expo-sqlite` wrapper, migration runner, migration `001_init` with
   `profiles` and `settings` (including `language`); `Repository` interface + in-memory
   implementation for tests; default profile created on first boot.
9. `docs/DECISIONS.md` entries (state library, DB testing strategy, web layout, i18n
   approach).
10. Adjust `app.json` (name "CYCLE", `userInterfaceStyle: "dark"`, splash/adaptive icon
    colors matching the theme).
11. README: test commands, i18n guide (how to add strings), updated architecture.

Tests (write first): migration runner (order, idempotence) with a fake; in-memory
profile repository; tabs render; dark theme applied by default; locale detection
(`pt-BR`, `pt-PT` → `pt-BR`; `en-US`, `de-DE` → `en`); override persists; `formatKg`
in both locales; catalog key parity.

Acceptance: `npm test`, `npx expo lint`, `npx tsc --noEmit` green; the app opens on web
(`npx expo start --web`) showing the 5 tabs in the dark theme, in English or Portuguese
depending on the setting.

---

## Stage 2 — Profile + reference 1RM · **sonnet**

Scope (SPEC §2, §12.2 profiles):
- Migration `reference_1rm_history`; repository with `getCurrent(profileId, lift)`,
  `listHistory`, `record(value, source)` (append-only).
- `domain/validation.ts`: 1RM validation (> 0, ≤ 600, 2 decimals) returning error codes.
- Onboarding (first boot without 1RMs) → Settings → 1RMs (edit anytime) showing history
  per lift.
- Profile selector/creation/rename in Settings; switching profile isolates data.
- Language selector in Settings (System / English / Português) wired to Stage 1 i18n.

Tests: validation (edges), append-only (editing creates a new record), current = latest
by effective date, profile isolation, onboarding flow (RTL) in both locales, decimal
input with `,` in pt-BR.

Acceptance: the user enters 1RMs, reopens the app and the values persist; history shows
previous versions.

---

## Stage 3 — Increments and rounding · **haiku**

Scope (SPEC §5): `domain/rounding.ts` (`roundLoad(kg, increment, mode)`), increment
settings (presets + custom, optional per-lift override, mode), Settings UI with a preview
"example: 96.25 → 95.0 kg" (localized formatting).

Tests (case table): exact multiples; tie → down in nearest mode; 1.25 / 1.5 / custom
0.5; down/up modes; large values; no floating-point error (e.g.
`roundLoad(0.1 + 0.2, …)`); invalid custom rejected.

Acceptance: changing the increment persists and the preview updates.

---

## Stage 4 — Program database + custom 5/3/1 · **sonnet**

Scope (SPEC §3.1–3.5):
- `programs/schema.ts` (SPEC §3.2 types) + validator; a test that runs the validator on
  **all** registered templates (fails if `source`, `version` is missing, weeks are
  inconsistent, etc.).
- `programs/data/cycle-531-custom.ts` exactly as SPEC §3.3-A.
- `programs/registry.ts` (list, find by id, filter by lift) and `programs/blocks.ts`
  (`getBlock(template, startWeek)` → up to 3 weeks, never compressed; tested with a fake
  13-week template).
- Per-profile configuration of the 5/3/1 percentages (settings), range 30–105%.
- "Programs" screen (list + original-structure detail, verification badge), localized.

Tests: schema, 5/3/1 = 3 sets every week with reps 5/3/1, default and custom
percentages, `getBlock` edge cases (start, partial end).

Acceptance: the Programs screen lists the custom 5/3/1 with source and structure;
percentages are editable.

---

## Stage 5 — Periodization generator + table · **opus**

Central feature; opus for engine modeling and reactivity.

Scope (SPEC §1, §4, §6-A):
- Migrations `session_slots`, `periodizations`, `generated_sessions`.
- `domain/periodization.ts`: pure `generatePeriodization(slots, templates, ref1RMs,
  rounding, params) → Periodization`; exact + rounded load; tonnage and total reps per
  session/week/lift; warnings as codes (missing 1RM, incomplete frequency, unverified
  data → no load).
- Memoized store/selectors: any change to slots, 1RM, rounding or params recalculates.
- Periodization UI: slot editor (add, duplicate, remove, reorder ↑/↓, choose lift →
  program → day → block starting week), "Generate/Activate" button (saves a snapshot
  with a start date) and **Table view** (SPEC §6-A), responsive.
- Only 5/3/1 is available at this stage — the engine must be generic (tested with fake
  multi-day, multi-week templates with `addKg` and accessory items).

Tests: SPEC §13 step 3 cases; mixed lifts; reordering changes the session number;
changing 1RM recalculates; `unverified` prescription produces no load; performance (10
slots < 50 ms); table component renders exact/rounded values in both locales.

Acceptance: the user builds 3 sessions with 5/3/1 (bench, squat, deadlift) and sees the
correct three-week table; editing a 1RM in Settings updates the table.

---

## Stage 6 — Calendar + session detail · **sonnet**

Scope (SPEC §6-B): Table | Calendar toggle in Periodization, week × session grid, route
`src/app/session/[id].tsx` with the detailed prescription (sets, %, exact → rounded,
volume, accessories, warnings, program + version + source). Both views consume the same
selector.

Tests: synchronization (changing a slot is reflected in both views), navigation to the
detail with correct params, detail render.

Acceptance: tapping any card opens the correct detail.

---

## Stage 7 — Smolov Jr. · **opus**

Opus for the fidelity and source-research requirements.

Scope (SPEC §3.3-C):
1. Research and identify source(s) for the original Smolov Jr.; record them in `source`
   and `docs/DECISIONS.md` (citations, URLs, access date, discrepancies between sources
   and which one was adopted).
2. Transcribe into `programs/data/smolov-jr.ts`: 3 weeks × 4 days, sets/reps/% and the
   week 2–3 absolute increments as a `configurable` parameter with the original range
   (distinguishing upper/lower body if the original does).
3. Selectable lift; parameter UI in the slot editor (rejects values outside the range).
4. "Add all days of this program" action; incomplete-frequency warning.

Tests: data snapshot against the source table (explicit test per day), week 2–3 loads
with increment, range validation, schema.

Acceptance: the SPEC §13 configuration (Session 2 = Bench / Smolov Jr. day 1) generates
correct loads across the 3 weeks.

---

## Stage 8 — Smolov (full original) · **opus**

Scope (SPEC §3.3-B): source research; full transcription (every phase and week,
including the introductory microcycle, base, switching, intense and taper/test);
anything that cannot be confirmed is `unverified` with a note; block starting-week
selection in the UI (partial block at the end). Lift fixed to squat. Phase labels in en
(+ pt-BR translation).

Tests: snapshot per week/day, total duration, no compressed week, `getBlock` at every
valid position, `unverified` prescriptions produce no load.

Acceptance: the user chooses Smolov and browses any 3-week block of the ~13 weeks.

---

## Stage 9 — Sheiko (multiple templates) · **opus**

Scope (SPEC §3.3-D): research and selection of templates with a reliable source (one
file per template, `programs/data/sheiko-<id>.ts`); multi-lift days (filter items by the
slot's lift, show the day's other items as information); accessories as
`kind: 'accessory'`; template selector in the slot editor; the Programs screen groups
"Sheiko" with its templates.

Tests: snapshot per template, lift filtering on multi-lift days, long templates with
blocks, schema.

Acceptance: SPEC §13 Session 4 (Deadlift / Sheiko) generates the correct prescription;
unverified templates show the badge and calculate no load where data is missing.

---

## Stage 10 — Performance tracking + RIR/RPE · **sonnet**

Scope (SPEC §7): migrations `performed_sessions`, `performed_sets`; `domain/rpe.ts`
(mapping and conversions, including half points, divergence validation); logging screen
from the session detail (pre-filled with the prescribed load, extra sets, notes,
auto-saved draft, "Complete session" with snapshot); prescribed vs. actual comparison;
the **Training** tab shows the next pending session and sessions in progress.

Tests: full RIR↔RPE table, RPE→RIR with half points, divergence > 0.5 is an error, field
validation, draft persists, snapshot immutable after changing 1RM.

Acceptance: SPEC §13 step 4.

---

## Stage 11 — e1RM engine · **opus**

Scope (SPEC §8): `domain/e1rm/` with `rts` (transcribed chart with source), `epley-rir`,
`brzycki-rir`; validity rules; representative-set selection; migration `e1rm_history`;
immediate display after a valid set and in the summary; comparison with the previous
e1RM; formula selection in Settings; "Use as new reference 1RM" action (confirmation,
origin `from_e1rm`).

Tests: SPEC §8.1 acceptance example (exact values), validity edges (RIR 5, n = 13,
r = 0), representative selection (every tie-breaker), a multi-set session yields a
single record per lift, changing formula does not rewrite history.

Acceptance: SPEC §13 step 5 (up to the stored e1RM).

---

## Stage 12 — Progression dashboard · **sonnet**

Scope (SPEC §9): `domain/stats.ts` (current, latest, previous, highest, Δ kg, Δ %,
baseline per period); `npx expo install react-native-svg`; in-house `LineChart` (e1RM
line + reference-1RM steps, axes, tap/hover tooltip, localized axis labels and dates);
Progress screen with 3 sections (Bench, Squat, Deadlift) and period filter.

Tests: statistics (empty history, 1 point, many, baseline per period), chart scale
(domain/ticks), render and tooltip interaction.

Acceptance: after logging sessions, cards and charts reflect the data.

---

## Stage 13 — Training history · **sonnet**

Scope (SPEC §10): list with filters (lift, program, period), detail with prescribed vs.
actual, RIR/RPE, e1RM, comparison with equivalent previous sessions; editing a past
session recomputes only its e1RM.

Tests: filters, ordering, immutability (changing program/1RM does not alter history),
editing recomputes only that session's e1RM.

Acceptance: SPEC §13 steps 5–6 (History lists the session; it does not change after
changing the 1RM).

---

## Stage 14 — Home dashboard + responsiveness + i18n audit · **sonnet**

Scope (SPEC §11): Dashboard screen (active periodization: current week, next session,
latest e1RM per lift, shortcuts); desktop layout review (sidebar with every section,
three-week table side by side) and mobile; accessibility audit (labels, targets,
contrast); full i18n audit — no hard-coded strings, every screen reviewed in `en` and
`pt-BR`, number/date formatting consistent.

Tests: Dashboard render with and without data; responsive layout at widths 375 / 1280
(mocked dimensions); a static check/test that flags string literals rendered directly in
`<Text>` inside `src/app` and `src/components`.

Acceptance: full navigation on mobile and web, no placeholder screens left, the app is
fully usable in both languages.

---

## Stage 15 — Final review and E2E · **opus**

Scope: integration test covering the whole SPEC §13 flow (in-memory repositories +
screens, including the language switch); critical review of mathematical accuracy and
program-data fidelity against the recorded sources; `npx expo-doctor`; README review
(features list matches what is implemented, screenshots in `docs/images/`, limitations
such as `unverified` data); fix any discrepancies found.

Acceptance: E2E flow green locally; stages 0–14 ✅ in the status table.

---

## Stage 16 — CI pipeline + Android APK build (GitHub Actions + Docker) · **sonnet**

**Goal:** CI on every PR/push, and every push to `main` produces an installable APK,
built inside a Docker container in GitHub Actions (SPEC §12.3, §12.4). No EAS account or
local Android Studio needed.

Scope:
1. **CI workflow** `.github/workflows/ci.yml`: on `pull_request` and `push` to `main`;
   Node from `.nvmrc`, `npm ci`, `npx expo lint`, `npx tsc --noEmit`,
   `npm test -- --coverage` (thresholds enforced), plus `shellcheck` and `actionlint`
   for the files below. Cache npm.
2. Read the Expo SDK 58 docs for the required toolchain (JDK, Android SDK platform /
   build-tools, NDK, Node versions) and for local builds via `npx expo prebuild`
   (Continuous Native Generation — `android/` is generated inside the container, never
   committed).
3. `docker/android/Dockerfile`: pinned base image with the JDK, Node, Android SDK
   command-line tools, accepted licenses, platform, build-tools and NDK at the versions
   from step 2. Non-root user. No secrets baked in.
4. `scripts/build-apk.sh` (runs inside the container): `npm ci` →
   `npx expo prebuild --platform android --clean --no-install` →
   `cd android && ./gradlew assembleRelease` → copy the APK to `dist/` as
   `cycle-<version>-<short-sha>.apk`. Same script works locally:
   `docker build -t cycle-android docker/android && docker run --rm -v "$PWD":/app cycle-android`.
5. Signing: if repository secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` are present, sign the release with them
   (configured through a config plugin or Gradle properties passed at build time — never
   by editing generated native files by hand); otherwise sign with the debug keystore and
   name the file `…-unsigned-debugkey.apk` so it is clearly an initial/test build.
6. **APK workflow** `.github/workflows/android-apk.yml`: triggers on `push` to `main`
   and `workflow_dispatch`; steps: checkout → Docker Buildx with GitHub Actions layer
   cache → build the image → run the container with the workspace mounted (Gradle and npm
   caches via `actions/cache`) → upload `dist/*.apk` with `actions/upload-artifact`
   (retention 30 days) → publish/update a pre-release `latest-main` with the APK
   attached. `concurrency` group cancels superseded runs. Minimal `permissions`
   (`contents: write` only for the release step). Optional PR trigger via label
   `build-apk` (build without publishing) so the pipeline can be verified in this
   stage's PR.
7. README: replace the APK placeholder with (a) download from the `latest-main`
   pre-release or the Actions artifact, (b) local Docker build commands, (c) EAS
   alternative, release-signing secrets and how to install the APK on a device; add CI
   badges.
8. Record toolchain versions and signing approach in `docs/DECISIONS.md`.

Verification: CI green on this stage's PR; an APK build run succeeds (label trigger or
after merge) with a downloadable artifact; if possible, the APK installs and opens on an
Android emulator/device (record how it was verified).

Acceptance: after merge, CI and APK runs on `main` are green and the `latest-main`
pre-release contains the APK; all stages ✅.
