# `src/data/` — persistence

SQLite (`expo-sqlite`) database, versioned migrations and repositories.

- `database.ts` — `SqlDatabase`, the subset of expo-sqlite's async API the layer uses.
- `migrate.ts` + `migrations/NNN_<name>.ts` — schema versions tracked in
  `PRAGMA user_version`; each migration runs in its own transaction. Append new files and
  register them in `migrations/index.ts`; never edit a released migration.
- `repositories.ts` — repository **interfaces**, entity types and error classes: `profiles`, `settings`
  (`language`, `theme`, `onboardingCompleted`, `experience`, rest/notification/keep-awake, bar and plates,
  `lastBackupAt`, and the v4 `focus`, `e1rmFormula`, `effortScale`, `roundingMode`), `exercises` (custom exercises, increment overrides, notes, bar weights), `plans` (plan
  CRUD, archive, active plan, cycle state), `workouts` (draft, complete, amend, delete, listings, exercise
  sessions; superset groups and `drop` sets), `bodyMetrics` (one value per date and kind), `referenceMaxes` (append-only 1RM records: `list`, `add`,
  `delete`; SPEC-v4 §2) and `backup`
  (`exportProfile`, and `restoreAsNewProfile` in one transaction with id remapping; SPEC-v3 §8). Repositories check structure and state only; business
  validation belongs to the caller. v1 tables (migrations 001–009) stay in the database untouched;
  migration 010 copies completed v1 sessions into `workouts` (SPEC §11.3) and no repository reads v1 tables.
- `migrations/011_v3_companion.ts` — the v3 schema (SPEC-v3 §12): `body_metrics`, exercise notes and bar
  weights, `workout_exercises.superset_group` and the new settings columns. Migrations 001–011 are
  immutable.
- `migrations/012_v4_strength.ts` — the v4 schema (SPEC-v4 §11.1): `reference_maxes`, the settings columns
  `focus`, `effort_scale`, `strength_e1rm_formula`, `strength_rounding_mode`, `workout_exercises.prescription`
  and the carry-over of the v1 reference 1RM history (origin `v1`, focus `strength`). Plan percent schemes
  and program blocks live in the plan's JSON `content`; half-point RIR needs no column change. Migrations
  001–012 are immutable.
- `backup-shared.ts`, `logbook-shared.ts` — what both backup implementations share: the export, the
  restore plan (what is written, decided before the first write) and the validation helpers.
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
