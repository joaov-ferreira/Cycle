# `src/data/` — persistence

SQLite (`expo-sqlite`) database, versioned migrations and repositories.

- `database.ts` — `SqlDatabase`, the subset of expo-sqlite's async API the layer uses.
- `migrate.ts` + `migrations/NNN_<name>.ts` — schema versions tracked in
  `PRAGMA user_version`; each migration runs in its own transaction. Append new files and
  register them in `migrations/index.ts`; never edit a released migration.
- `repositories.ts` — repository **interfaces**, entity types and error classes: `profiles`, `settings`
  (`language`, `theme`, `onboardingCompleted`, `experience`), `exercises` (custom exercises, increment
  overrides), `plans` (plan CRUD, archive, active plan, cycle state) and `workouts` (draft, complete,
  amend, delete, listings, exercise sessions). Repositories check structure and state only; business
  validation belongs to the caller. v1 tables (migrations 001–009) stay in the database untouched;
  migration 010 copies completed v1 sessions into `workouts` (SPEC §11.3) and no repository reads v1 tables.
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
