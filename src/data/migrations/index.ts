import type { Migration } from '../migrate';
import { migration001Init } from './001_init';
import { migration002Reference1rm } from './002_reference_1rm';
import { migration003ProfileState } from './003_profile_state';
import { migration004Rounding } from './004_rounding';
import { migration005ProgramParams } from './005_program_params';
import { migration006Periodization } from './006_periodization';
import { migration007Performance } from './007_performance';
import { migration008E1rm } from './008_e1rm';
import { migration009E1rmRevisions } from './009_e1rm_revisions';
import { migration010V2Logbook } from './010_v2_logbook';
import { migration011V3Companion } from './011_v3_companion';
import { migration012V4Strength } from './012_v4_strength';

/** Every schema migration, in order. Append new files as `NNN_<name>.ts`; never edit old ones. */
export const migrations: readonly Migration[] = [
  migration001Init,
  migration002Reference1rm,
  migration003ProfileState,
  migration004Rounding,
  migration005ProgramParams,
  migration006Periodization,
  migration007Performance,
  migration008E1rm,
  migration009E1rmRevisions,
  migration010V2Logbook,
  migration011V3Companion,
  migration012V4Strength,
];
