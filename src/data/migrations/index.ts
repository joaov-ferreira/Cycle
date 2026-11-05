import type { Migration } from '../migrate';
import { migration001Init } from './001_init';

/** Every schema migration, in order. Append new files as `NNN_<name>.ts`; never edit old ones. */
export const migrations: readonly Migration[] = [migration001Init];
