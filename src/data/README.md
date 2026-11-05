# `src/data/` — persistence

SQLite (`expo-sqlite`) database, versioned migrations and repositories.

- `database.ts` — `SqlDatabase`, the subset of expo-sqlite's async API the layer uses.
- `migrate.ts` + `migrations/NNN_<name>.ts` — schema versions tracked in
  `PRAGMA user_version`; each migration runs in its own transaction. Append new files and
  register them in `migrations/index.ts`; never edit a released migration.
- `repositories.ts` — repository **interfaces** and entity types (`profiles` incl. rename and
  the remembered active profile, `settings`, append-only `referenceOneRms`, `rounding`:
  the load increment, rounding mode and per-lift increment overrides, `programParams`:
  athlete-chosen values of configurable template parameters, by template and parameter id;
  ranges are validated by `src/programs/` through the store, not by the repository;
  `sessionSlots`: the ordered session slots of the periodization editor; `periodizations`:
  activated periodizations, immutable snapshots of the configuration and the generated sessions
  stored as JSON, the latest being the active one), `performances`: performed sessions of an
  activated periodization (`performed_sessions` / `performed_sets`): a draft is overwritten in
  place on every save, completing it stores the date and a snapshot and makes it immutable),
  `e1rmHistory`: append-only session e1RMs (`e1rm_history`, migrations 008–009) with the formula and the
  source set. A session has at most one current estimate per lift: editing a past session appends a newer
  revision (`supersede`, or a tombstone with `clear`) that replaces it in `list`; `revisions` is the audit
  trail and no row is ever updated or deleted. `settings.e1rmFormula` is the formula for new estimates
  (default `rts`). `performances.amend` replaces the sets and notes of a completed session, keeping its
  date and snapshot.
- `memory/` — in-memory implementation (tests).
- `sqlite/` — SQLite implementation and `openAppDatabase()` / `openSqliteRepositories()`.
- `repositories.contract.ts` — one behavioral test suite run against **both**
  implementations (SQLite runs on Node's built-in `node:sqlite` in Jest, through
  `src/test-utils/node-sqlite.ts`).

Dependency rules:

- May import `src/domain/` and type-only declarations from `src/i18n/locale.ts`.
- Must not import React, `src/state/`, `src/components/` or `src/app/`.
- Every table except `profiles` is scoped by `profile_id`.
- Callers use the repository interfaces, never SQL.
