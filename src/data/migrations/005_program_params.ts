import type { Migration } from '../migrate';

/**
 * Athlete-chosen values of configurable template parameters (SPEC §3.4), per profile, e.g. the
 * custom 5/3/1 percentages. A parameter without a row uses the template's default. Ranges
 * differ per template and parameter, so they are validated in `src/programs/`, not by CHECKs.
 */
export const migration005ProgramParams: Migration = {
  version: 5,
  name: 'program_params',
  up: (db) =>
    db.execAsync(`
      CREATE TABLE program_params (
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        template_id TEXT NOT NULL,
        param_id TEXT NOT NULL,
        value REAL NOT NULL,
        PRIMARY KEY (profile_id, template_id, param_id)
      );
    `),
};
