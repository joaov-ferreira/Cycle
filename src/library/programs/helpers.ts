/**
 * Shared building blocks of the program data files: item types, the standard roles and the
 * compact set notation `s(sets, reps, fraction of 1RM)`.
 */
import type { ProgramItem, ProgramRole, ProgramSet } from '../../domain/program';

export type MainItem = Extract<ProgramItem, { kind: 'main' }>;
export type AccessoryItem = Extract<ProgramItem, { kind: 'accessory' }>;
export type InfoItem = Extract<ProgramItem, { kind: 'info' }>;

/** v1 `lift: 'selected'`: the user maps the role to any library exercise. */
export const LIFT_ROLE: ProgramRole = { id: 'lift', label: { en: 'Lift', 'pt-BR': 'Exercício' } };

export const BENCH_ROLE: ProgramRole = {
  id: 'bench',
  label: { en: 'Bench press', 'pt-BR': 'Supino reto' },
  defaultExerciseId: 'barbell-bench-press',
};
export const SQUAT_ROLE: ProgramRole = {
  id: 'squat',
  label: { en: 'Squat', 'pt-BR': 'Agachamento' },
  defaultExerciseId: 'barbell-back-squat',
};
export const DEADLIFT_ROLE: ProgramRole = {
  id: 'deadlift',
  label: { en: 'Deadlift', 'pt-BR': 'Levantamento terra' },
  defaultExerciseId: 'conventional-deadlift',
};

/** `sets × reps @ percent` (one set when `repeat` is 1); percentages refer to the role's 1RM. */
export const s = (repeat: number, reps: number, percent: number): ProgramSet =>
  repeat === 1 ? { reps, percent } : { repeat, reps, percent };
