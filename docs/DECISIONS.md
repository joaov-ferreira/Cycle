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
