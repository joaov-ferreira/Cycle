# CYCLE

[![CI](https://github.com/joaov-ferreira/Cycle/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/joaov-ferreira/Cycle/actions/workflows/ci.yml)
[![Android APK](https://github.com/joaov-ferreira/Cycle/actions/workflows/android-apk.yml/badge.svg?branch=main)](https://github.com/joaov-ferreira/Cycle/actions/workflows/android-apk.yml)

A general weight-training logbook: an exercise library, plans with load and deload cycles, a
set / reps / load logger and automatic load progression from your history.

## What is CYCLE

CYCLE is a mobile-first app for iOS, Android and the web, built with Expo. **Version 2 is in
progress:** the app is being converted from a powerlifting periodization manager (v1) into a
general weight-training app. The v1 features (reference 1RMs, program database, three-week
periodization generator, e1RM, v1 history) were removed; the user data they created stays in the
local database and is carried over to the v2 logbook in a later stage.

- The product is specified in [`docs/SPEC.md`](docs/SPEC.md) (source of truth).
- The staged implementation plan and its status table are in [`docs/PLAN.md`](docs/PLAN.md).

**Status:** Stage 1 (remove v1, v2 skeleton) is done. What the app does today: the navigation
shell (bottom tabs Home / Plan / Workout / Progress / More on phones, a sidebar at widths ≥ 900 px),
placeholder screens for every route of the spec, and a working Settings screen (profile, theme,
language). Bilingual interface (English / Brazilian Portuguese, locale-aware number and date
formatting), dark theme by default (light option).

## Tech stack and architecture

- Expo SDK 58, React Native 0.88, TypeScript.
- Expo Router for navigation: every file in `src/app/` is a screen, `_layout.tsx` files
  define navigators. Mobile uses five bottom tabs (Home, Plan, Workout, Progress, More; More links
  to Exercises, History and Settings); at window widths ≥ 900 px the tab bar is replaced by a sidebar
  (`AppShell`, in the root layout) with Home, Plan, Workout, Progress, Exercises, History and
  Settings. It stays visible on the stack routes.
- `expo-sqlite` for local persistence (native and web), behind repository interfaces.
- `expo-localization` for device locale detection; in-house `t()` for translations.
- `zustand` for app state (stores created per app run, consumed through selectors).
- `jest-expo` + `@testing-library/react-native` for tests.
- `react-native-svg` for the in-house progress charts (no charting library).

Layers (from [SPEC §11.1](docs/SPEC.md#111-layered-architecture-mandatory-separation)):

```
src/
  domain/      # pure logic: rounding, chart-scale, period, validation (more in later stages)
  library/     # pure data: built-in exercises, plan templates, registries (later stages)
  data/        # persistence: expo-sqlite, migrations, repositories (interfaces + impl)
  state/       # stores/hooks connecting data ↔ domain ↔ UI
  components/  # UI (screens and reusable components), one folder per feature
  i18n/        # translation catalogs (one file per namespace and locale), t(), formatters
  app/         # Expo Router routes (screens and layouts only)
```

Supporting folders: `src/constants/theme.ts` (design tokens) and `src/test-utils/`
(test-only helpers). Each layer has a `README.md` describing its contents and dependency
rules.

Dependency rules:

- `domain/` and `library/` are pure TypeScript: they do not import React, Expo, `data/`
  or `i18n/`.
- `data/` exposes repository interfaces; tests use an in-memory implementation.
- `app/` contains only routes and layouts. Components, hooks and utilities live outside it.
- Migrations `001`–`009` (v1) are immutable: installed apps keep their database history.
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

Coverage thresholds (`jest.config.js`): at least 80% of lines globally, and at least 95% in
`src/domain/` and `src/library/` once those folders contain code.

Testing strategy:

- Pure logic (`src/domain/`, `src/library/`) has unit tests with hand-computed expected
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

Every push to `main` builds an Android APK inside a Docker container on GitHub Actions
(`.github/workflows/android-apk.yml`). Native projects are generated with `npx expo prebuild`
(Continuous Native Generation) in the container and are never committed.

### Download

- **Latest build of `main`**: the
  [`latest-main` pre-release](https://github.com/joaov-ferreira/Cycle/releases/tag/latest-main)
  always holds the APK of the newest commit on `main`.
- **Actions artifact**: open a run of the
  [Android APK workflow](https://github.com/joaov-ferreira/Cycle/actions/workflows/android-apk.yml)
  and download `cycle-apk` (kept for 30 days). Run the workflow manually with "Run workflow", or
  add the `build-apk` label to a pull request to build one without publishing.

File names are `cycle-<version>-<short-sha>.apk` (release keystore) or
`cycle-<version>-<short-sha>-unsigned-debugkey.apk`: signed with the debug key, a test build only.

### Install on a device

Copy the APK to the phone (or download it there), open it and allow "Install unknown apps" for
the app you opened it from, or install over USB with `adb install cycle-<...>.apk`. Updates only
install over a build signed with the same key, so uninstall first when switching between a
debug-key build and a release-key build (this erases the local data).

### Release signing

Without secrets the APK is signed with the debug keystore. To sign with your own key, create a
keystore once and add four repository secrets (Settings, Secrets and variables, Actions):

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore cycle-release.jks -alias cycle \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 cycle-release.jks   # value of ANDROID_KEYSTORE_BASE64 (macOS: base64 -i cycle-release.jks)
```

`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and
`ANDROID_KEY_PASSWORD`. Keep the keystore safe: losing it means users must uninstall to update.
The signing configuration is added to the generated Gradle project by the config plugin
`plugins/with-release-signing.js` from Gradle properties passed at build time; no native file is
edited by hand.

### Build locally with Docker

Requires only Docker (no Android Studio). The image (`docker/android/Dockerfile`) pins JDK 17,
Node 22, Android platform 37, build-tools 37.0.0, NDK 27.1.12297006 and CMake 3.30.5.

```bash
docker build -t cycle-android docker/android
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD":/app cycle-android
ls dist/        # cycle-2.0.0-<short-sha>-unsigned-debugkey.apk
```

The first build downloads Gradle and the Android dependencies (several GB, 15 to 30 minutes);
mount `-v cycle-gradle:/home/builder/.gradle` to keep the Gradle cache between runs. To sign with
a release key, add `-e ANDROID_KEYSTORE_BASE64 -e ANDROID_KEYSTORE_PASSWORD -e ANDROID_KEY_ALIAS
-e ANDROID_KEY_PASSWORD` with the same values as the secrets above. Set `CYCLE_ABIS` (default
`arm64-v8a,armeabi-v7a`) to change the target architectures, for example `-e CYCLE_ABIS=x86_64`
for an emulator.

### Alternative: EAS Build

```bash
npx eas-cli@latest build -p android --profile preview
```

This requires an Expo account. The repository does not contain an `eas.json`, so run
`npx eas-cli@latest build:configure` first (or let the build command prompt you to set it up).

### CI

`.github/workflows/ci.yml` runs on every pull request and push to `main`: `npm ci`,
`npx expo lint`, `npx tsc --noEmit`, `npm test -- --coverage` (thresholds enforced), plus
`shellcheck` on `scripts/` and `actionlint` on the workflows. Node comes from `.nvmrc`.

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

Catalogs are split by namespace (`app`, `tabs`, `navigation`, `common`, `home`, `plan`,
`planImport`, `workout`, `history`, `progress`, `exercises`, `picker`, `onboarding`, `settings`,
`profile`, `validation`): one file per namespace and locale, composed in `src/i18n/locales/en.ts`
and `src/i18n/locales/pt-BR.ts`.

1. Add the key to the namespace file in `src/i18n/locales/en/<namespace>.ts` (the source
   catalog), for example `workout.ts` for `workout.title`. A new namespace is a new file in both
   folders, registered in `en.ts`, `pt-BR.ts` and the namespace list in
   `src/i18n/catalogs.test.ts`.
2. Add the same key to `src/i18n/locales/pt-BR/<namespace>.ts`. Each pt-BR namespace is typed
   against its English one, so a missing or extra key fails `npx tsc --noEmit`, and
   `src/i18n/catalogs.test.ts` fails if the keys or `{{placeholders}}` differ between the two
   catalogs.
3. Use it in a component:

   ```tsx
   import { useT } from '@/i18n';

   const t = useT();
   <Text>{t('workout.title')}</Text>;
   ```

Placeholders use `{{name}}`: `t('validation.aboveMax', { max: 600 })`. Number params are
formatted for the locale (`1,500` / `1.500`). Plurals are objects with `one` and `other`
forms, selected by `params.count` (Portuguese treats 0 and 1 as singular):
`t('validation.tooManyDecimals', { count: 2 })`.

`src/i18n/no-hardcoded-strings.test.ts` scans `src/app` and `src/components` and fails on JSX text,
string literals rendered as children and literal `label`, `accessibilityLabel`, `placeholder` or
`title` props that contain letters: such text must come from `t()`.

### Formatting numbers and dates

Use the formatters from `useI18n()`: `formatKg(96.25)` gives `96.25 kg` in English and
`96,25 kg` in Portuguese. There are also `formatNumber`, `formatPercent` and `formatDate`.
Numeric inputs (`NumberInput`) accept the locale's decimal separator, and in Portuguese
both `,` and `.`. Domain code returns error codes, and the UI turns them into localized
messages.

## License

Released under the MIT License. See [`LICENSE`](LICENSE).
