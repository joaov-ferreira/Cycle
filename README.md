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
- Strength progression charts and training history.
- Bilingual interface: English and Brazilian Portuguese.

**Status:** under development. The codebase still contains the initial Expo template. Features
are built stage by stage; the current state of each stage is in the status table of
[`docs/PLAN.md`](docs/PLAN.md).

## Tech stack and architecture

- Expo SDK 58, React Native 0.88, TypeScript.
- Expo Router for navigation: every file in `src/app/` is a screen, `_layout.tsx` files
  define navigators.
- Planned: `expo-sqlite` for local persistence (Stage 1), `expo-localization` for locale
  detection (Stage 1), `react-native-svg` for charts (Stage 12), `jest-expo` and
  `@testing-library/react-native` for tests (Stage 1).

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

Dependency rules:

- `domain/` and `programs/` are pure TypeScript: they do not import React, Expo, `data/`
  or `i18n/`.
- `data/` exposes repository interfaces; tests use an in-memory implementation.
- `app/` contains only routes and layouts. Components, hooks and utilities live outside it.
- No random or mock values in production code.

## Running the app

Prerequisites: Node.js 22 with npm 10 (the version this project is developed with), and
either [Expo Go](https://expo.dev/go) on a phone or an iOS/Android simulator or emulator.
Native modules added in later stages may require a development build (see
[`AGENTS.md`](AGENTS.md)).

```bash
npm ci               # install exact dependencies from package-lock.json
npx expo start       # start the dev server; scan the QR code with Expo Go, or press a / i / w
npx expo start --web # open the app in the browser
npx expo lint        # lint
npx tsc --noEmit     # typecheck
```

Tests (`npm test`) are added in Stage 1.

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
The language defaults to the device locale (`pt*` → Portuguese, anything else → English)
and can be changed in Settings. Every user-facing string lives in `src/i18n/locales/`, and
the catalog details (how to add strings) are documented when the i18n layer lands in
Stage 1.

## License

Released under the MIT License. See [`LICENSE`](LICENSE).
