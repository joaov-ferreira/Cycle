# `src/data/` — persistence

SQLite (`expo-sqlite`) database, versioned migrations and repositories.

- `database.ts` — `SqlDatabase`, the subset of expo-sqlite's async API the layer uses.
- `migrate.ts` + `migrations/NNN_<name>.ts` — schema versions tracked in
  `PRAGMA user_version`; each migration runs in its own transaction. Append new files and
  register them in `migrations/index.ts`; never edit a released migration.
- `repositories.ts` — repository **interfaces** and entity types (`profiles` incl. rename and
  the remembered active profile, `settings`, append-only `referenceOneRms`, `rounding`:
  the load increment, rounding mode and per-lift increment overrides).
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
