This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Project documents

- `docs/SPEC.md` — product and technical specification (source of truth).
- `docs/PLAN.md` — staged implementation plan; each stage runs in a clean-context agent of the indicated model family.
- `docs/DECISIONS.md` — architecture/data-source decisions log (create it if missing; append, never rewrite history).

Read all three before starting any stage. Implement only the scope of your stage.

## Language

- **The project language is English**: code, identifiers, comments, docs, commit messages, branch names, PR titles/descriptions and `docs/DECISIONS.md` entries.
- **The app is bilingual**: English (`en`) and Brazilian Portuguese (`pt-BR`). Every user-facing string goes through the i18n layer in `src/i18n/` — never hard-code UI text in components. Add each new key to both `src/i18n/locales/en.ts` (source) and `src/i18n/locales/pt-BR.ts` in the same change; a missing translation is a failing build.
- Format numbers and dates with the locale-aware helpers from `src/i18n/` (e.g. `96.25 kg` vs `96,25 kg`). Domain code returns error/warning codes, never display strings.

## Development guidelines — TDD

All production code is written test-first. For every behavior:

1. **Red** — write a failing test that describes the behavior (from the SPEC acceptance criteria). Run it and confirm it fails for the right reason.
2. **Green** — write the minimum code to make it pass.
3. **Refactor** — clean up with all tests green. Commit.

Rules:

- Never write production code without a failing test that requires it. Bug fixes start with a test that reproduces the bug.
- Pure logic lives in `src/domain/` and `src/programs/` (no React/Expo/IO imports) and is unit-tested exhaustively, including edge cases. Coverage there must stay ≥ 95% lines; global ≥ 80%.
- Persistence is accessed only through repository interfaces in `src/data/`; tests use the in-memory implementation.
- UI is tested with `@testing-library/react-native` (behavior and accessible queries, not snapshots of markup). Screens that display formatted numbers are tested in both `en` and `pt-BR`.
- Program data (Smolov, Smolov Jr., Sheiko, RTS table) is covered by data tests that assert the transcription against the cited source, day by day. Never invent sets, reps or percentages; mark missing data `unverified`.
- Calculation tests use exact expected values (computed by hand and written in the test), never values produced by the code under test.
- Do not skip, disable or weaken tests to get green.
- Commit in small steps; a good rhythm is one commit per red→green→refactor cycle (e.g. `test: …` then `feat: …`, or a single commit containing both).

Definition of done for every change: `npm test`, `npx expo lint` and `npx tsc --noEmit` pass locally, and in CI once the CI workflow exists (it is added in the last plan stage). `README.md` is updated in the same change whenever the change affects what the README describes (features, setup, commands, build).

## Git & PR workflow

Work happens on a branch and lands on `main` through a PR whenever possible. Committing directly to `main` is **allowed** as a fallback (see step 8), but never skip the branch, TDD and green-checks steps.

1. Sync: `git fetch origin main && git checkout -B <branch> origin/main`.
   Branch names: `feat/<NN>-<slug>` for plan stages (as listed in `docs/PLAN.md`), `fix/<slug>`, `chore/<slug>`, `docs/<slug>`.
2. Develop with the TDD loop above, committing as you go. Use Conventional Commits (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`).
3. Before pushing: run tests, lint and typecheck; rebase on the latest `origin/main` if it moved.
4. Push: `git push -u origin <branch>`.
5. Open a PR to `main` (GitHub MCP tools). The PR description includes: stage/feature, summary, list of tests added, how to verify manually, and any decisions appended to `docs/DECISIONS.md`. Update the stage status in `docs/PLAN.md` within the same PR.
6. Wait for CI to be green (once CI exists; before that, the local checks are the gate). If it fails, reproduce locally, fix with a test, push again.
7. Merge the PR into `main` with **squash merge**, then delete the branch. One stage = one PR; the next stage starts only after the previous PR is merged.
8. **Direct-to-`main` fallback** — if a PR cannot be opened or merged (e.g. GitHub PR tooling is unavailable in the session), land the branch directly:
   ```bash
   git fetch origin main
   git checkout -B main origin/main
   git merge --squash <branch>
   git commit -m "<type>: <stage/feature summary>"   # Conventional Commit, same content a PR description would have
   npm test && npx expo lint && npx tsc --noEmit     # must pass on main before pushing
   git push origin main
   git push origin --delete <branch>                 # optional cleanup
   ```
   Never force-push `main`. Update the stage status in `docs/PLAN.md` in the same commit, and mention in the commit body that it was landed without a PR. CI on `main` (once it exists) must be green afterwards; if it is not, fix it immediately with a follow-up commit.
