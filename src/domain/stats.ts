/**
 * Statistics of the progress screens (SPEC §9): chart series, personal records, new records of
 * a workout, weekly sets per muscle group and recently trained exercises. Pure: no I/O, no
 * clocks (the reference time is passed in), no display strings.
 *
 * Only counted sets (done working sets with a weight and reps ≥ 1, `countedSets`) are used.
 */
import { allowsZeroLoad, type Equipment, type Exercise, type MuscleGroup } from './exercise';
import { countedSets, e1rm, volume } from './metrics';
import { periodStart, type Period } from './period';
import type { ExerciseSession, LoggedSet, Workout } from './workout';

/** Best e1RM over the counted sets with a weight above 0 (SPEC §6.1); `null` when none. */
export function bestE1rm(sets: readonly LoggedSet[]): number | null {
  let best: number | null = null;
  for (const set of countedSets(sets)) {
    const value = e1rm(set.weightKg, set.reps, set.rir ?? 0);
    if (value !== null && (best === null || value > best)) best = value;
  }
  return best;
}

/** Heaviest counted set; `null` when no set counts. */
export function topWeight(sets: readonly LoggedSet[]): number | null {
  let best: number | null = null;
  for (const set of countedSets(sets)) {
    if (best === null || set.weightKg > best) best = set.weightKg;
  }
  return best;
}

/** Most reps of a counted set; `null` when no set counts. */
export function bestReps(sets: readonly LoggedSet[]): number | null {
  let best: number | null = null;
  for (const set of countedSets(sets)) {
    if (best === null || set.reps > best) best = set.reps;
  }
  return best;
}

/** A metric of the progress chart (SPEC §9.1). */
export type Metric = 'e1rm' | 'topWeight' | 'volume' | 'reps';

/** The metrics offered for an exercise: zero-load equipment shows reps instead of load. */
export function metricsFor(equipment: Equipment): Metric[] {
  return allowsZeroLoad(equipment) ? ['reps', 'volume'] : ['e1rm', 'topWeight', 'volume'];
}

/** One point of a chart: one session. */
export interface SeriesPoint {
  workoutId: number;
  /** The session's `completedAt`. */
  at: string;
  value: number;
}

/** The value of a metric for one session's sets; `null` when the session has no counted set. */
function metricValue(sets: readonly LoggedSet[], metric: Metric): number | null {
  switch (metric) {
    case 'e1rm':
      return bestE1rm(sets);
    case 'topWeight':
      return topWeight(sets);
    case 'reps':
      return bestReps(sets);
    case 'volume':
      return countedSets(sets).length > 0 ? volume(sets) : null;
  }
}

/** Oldest first; ties on the completion time go to the lower workout id. */
function compareOldestFirst(a: ExerciseSession, b: ExerciseSession): number {
  return Date.parse(a.completedAt) - Date.parse(b.completedAt) || a.workoutId - b.workoutId;
}

/**
 * One point per session that has a value for the metric, oldest first. With `range`, only the
 * sessions completed at or after the start of the period (SPEC §9.1).
 */
export function exerciseSeries(
  sessions: readonly ExerciseSession[],
  metric: Metric,
  range?: { period: Period; now: Date },
): SeriesPoint[] {
  const start = range ? periodStart(range.period, range.now) : null;
  const startMs = start === null ? -Infinity : start.getTime();
  const points: SeriesPoint[] = [];
  for (const session of [...sessions].sort(compareOldestFirst)) {
    if (Date.parse(session.completedAt) < startMs) continue;
    const value = metricValue(session.sets, metric);
    if (value !== null) {
      points.push({ workoutId: session.workoutId, at: session.completedAt, value });
    }
  }
  return points;
}

/** The best set of an exercise: its weight and reps, with the session it was set in. */
export interface WeightRecord {
  valueKg: number;
  reps: number;
  at: string;
  workoutId: number;
}

/** The best e1RM of an exercise, with the session it was set in. */
export interface E1rmRecord {
  valueKg: number;
  at: string;
  workoutId: number;
}

/** Personal records of one exercise (SPEC §9.2); `null` without counted sets. */
export interface PersonalRecords {
  weight: WeightRecord | null;
  e1rm: E1rmRecord | null;
}

/**
 * Weight PR (heaviest counted set; ties go to more reps, then to the earliest session) and
 * e1RM PR (highest e1RM; ties go to the earliest session).
 */
export function personalRecords(sessions: readonly ExerciseSession[]): PersonalRecords {
  let weight: WeightRecord | null = null;
  let e1rmRecord: E1rmRecord | null = null;

  for (const session of [...sessions].sort(compareOldestFirst)) {
    for (const set of countedSets(session.sets)) {
      const beats =
        weight === null ||
        set.weightKg > weight.valueKg ||
        (set.weightKg === weight.valueKg && set.reps > weight.reps);
      if (beats) {
        weight = {
          valueKg: set.weightKg,
          reps: set.reps,
          at: session.completedAt,
          workoutId: session.workoutId,
        };
      }
    }

    const best = bestE1rm(session.sets);
    if (best !== null && (e1rmRecord === null || best > e1rmRecord.valueKg)) {
      e1rmRecord = { valueKg: best, at: session.completedAt, workoutId: session.workoutId };
    }
  }

  return { weight, e1rm: e1rmRecord };
}

/** A personal record set by a workout: the new value and the previous record it beat. */
export interface NewRecord {
  exerciseId: string;
  kind: 'weight' | 'e1rm';
  valueKg: number;
  previousKg: number;
}

/**
 * The records a completed workout sets (SPEC §9.2). `historyBefore` returns the sessions of an
 * exercise before this workout. The first session of an exercise sets no record; a value equal
 * to the previous record is not a record. Order: workout exercise order, `weight` before `e1rm`.
 */
export function newRecords(
  workout: Workout,
  historyBefore: (exerciseId: string) => readonly ExerciseSession[],
): NewRecord[] {
  const records: NewRecord[] = [];
  for (const exercise of workout.exercises) {
    const history = historyBefore(exercise.exerciseId);
    if (history.length === 0) continue;

    const previous = personalRecords(history);
    const top = topWeight(exercise.sets);
    if (previous.weight !== null && top !== null && top > previous.weight.valueKg) {
      records.push({
        exerciseId: exercise.exerciseId,
        kind: 'weight',
        valueKg: top,
        previousKg: previous.weight.valueKg,
      });
    }

    const best = bestE1rm(exercise.sets);
    if (previous.e1rm !== null && best !== null && best > previous.e1rm.valueKg) {
      records.push({
        exerciseId: exercise.exerciseId,
        kind: 'e1rm',
        valueKg: best,
        previousKg: previous.e1rm.valueKg,
      });
    }
  }
  return records;
}

/** Monday 00:00 (local time) of the ISO week (Monday–Sunday) that contains `date`. */
export function isoWeekStart(date: Date): Date {
  const daysSinceMonday = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysSinceMonday);
}

/** True when both dates fall in the same ISO week (local time). */
export function sameIsoWeek(a: Date, b: Date): boolean {
  return isoWeekStart(a).getTime() === isoWeekStart(b).getTime();
}

/**
 * Counted sets per muscle group in the ISO week of `weekOf` (SPEC §9.3): the primary muscle
 * counts 1 per counted set, each secondary muscle 0.5. Only completed workouts count; unknown
 * exercises are skipped; muscles without sets are omitted.
 */
export function weeklyMuscleSets(
  workouts: readonly Workout[],
  findExercise: (id: string) => Pick<Exercise, 'primaryMuscle' | 'secondaryMuscles'> | undefined,
  weekOf: Date,
): Partial<Record<MuscleGroup, number>> {
  const start = isoWeekStart(weekOf);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  const result: Partial<Record<MuscleGroup, number>> = {};
  const add = (muscle: MuscleGroup, amount: number): void => {
    result[muscle] = (result[muscle] ?? 0) + amount;
  };

  for (const workout of workouts) {
    if (workout.status !== 'completed' || workout.completedAt === null) continue;
    const at = Date.parse(workout.completedAt);
    if (at < start.getTime() || at >= end.getTime()) continue;

    for (const exercise of workout.exercises) {
      const info = findExercise(exercise.exerciseId);
      if (info === undefined) continue;
      const count = countedSets(exercise.sets).length;
      if (count === 0) continue;
      add(info.primaryMuscle, count);
      for (const muscle of info.secondaryMuscles) add(muscle, count * 0.5);
    }
  }

  return result;
}

/**
 * Distinct exercise ids with a counted set in completed workouts, most recently trained first
 * (SPEC §9.1). Within one workout, exercises keep their order.
 */
export function trainedExerciseIds(workouts: readonly Workout[]): string[] {
  const timed: { workout: Workout; at: number }[] = [];
  for (const workout of workouts) {
    if (workout.status === 'completed' && workout.completedAt !== null) {
      timed.push({ workout, at: Date.parse(workout.completedAt) });
    }
  }
  timed.sort((a, b) => b.at - a.at || b.workout.id - a.workout.id);

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const { workout } of timed) {
    for (const exercise of workout.exercises) {
      if (seen.has(exercise.exerciseId) || countedSets(exercise.sets).length === 0) continue;
      seen.add(exercise.exerciseId);
      ids.push(exercise.exerciseId);
    }
  }
  return ids;
}
