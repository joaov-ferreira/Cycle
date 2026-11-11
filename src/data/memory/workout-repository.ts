import type { ExerciseSession, Workout, WorkoutExercise } from '@/domain/workout';

import { assertValidExercises, cloneJson, storedWorkoutExercise } from '../logbook-shared';
import {
  PlanNotFoundError,
  WorkoutNotFoundError,
  WorkoutStateError,
  type WorkoutRepository,
} from '../repositories';
import { requireProfile, type MemoryState } from './memory-state';

/** Newest completion first; ties by newest id. */
const newestFirst = (a: Workout, b: Workout): number =>
  (a.completedAt as string) < (b.completedAt as string)
    ? 1
    : (a.completedAt as string) > (b.completedAt as string)
      ? -1
      : b.id - a.id;

const hasExercise = (w: Workout, exerciseId: string) =>
  w.exercises.some((e) => e.exerciseId === exerciseId);

export function createMemoryWorkoutRepository(state: MemoryState): WorkoutRepository {
  function find(profileId: number, id: number): Workout {
    const found = state.workouts.get(id);
    if (!found || found.profileId !== profileId) throw new WorkoutNotFoundError(id);
    return found;
  }

  const inProgress = (profileId: number) =>
    [...state.workouts.values()].find((w) => w.profileId === profileId && w.status === 'in_progress');

  const completed = (profileId: number) =>
    [...state.workouts.values()]
      .filter((w) => w.profileId === profileId && w.status === 'completed')
      .sort(newestFirst);

  function store(workout: Workout): Workout {
    state.workouts.set(workout.id, cloneJson(workout));
    return cloneJson(workout);
  }

  function requireStatus(workout: Workout, expected: Workout['status']): void {
    if (workout.status !== expected) {
      throw new WorkoutStateError(workout.id, workout.status, expected);
    }
  }

  /** Copies the entries as stored: a missing superset group is null, a null prescription is absent. */
  const withGroups = (exercises: WorkoutExercise[]): WorkoutExercise[] =>
    cloneJson(exercises).map(storedWorkoutExercise);

  const exercisesOf = (exercises: WorkoutExercise[]) => {
    assertValidExercises(exercises);
    return withGroups(exercises);
  };

  return {
    async getInProgress(profileId) {
      const found = inProgress(profileId);
      return found ? cloneJson(found) : null;
    },
    async saveDraft(profileId, draft) {
      requireProfile(state, profileId);
      assertValidExercises(draft.exercises);
      if (draft.planId !== null) {
        const plan = state.plans.get(draft.planId);
        if (!plan || plan.profileId !== profileId) throw new PlanNotFoundError(draft.planId);
      }
      const id = inProgress(profileId)?.id ?? state.nextId.workout++;
      return store({
        ...cloneJson(draft),
        exercises: withGroups(draft.exercises),
        id,
        profileId,
        status: 'in_progress',
        completedAt: null,
      });
    },
    async complete(profileId, id, final) {
      const current = find(profileId, id);
      requireStatus(current, 'in_progress');
      return store({
        ...current,
        status: 'completed',
        completedAt: final.completedAt ?? state.clock().toISOString(),
        notes: final.notes,
        exercises: exercisesOf(final.exercises),
      });
    },
    async amend(profileId, id, changes) {
      const current = find(profileId, id);
      requireStatus(current, 'completed');
      return store({ ...current, notes: changes.notes, exercises: exercisesOf(changes.exercises) });
    },
    async delete(profileId, id) {
      find(profileId, id);
      state.workouts.delete(id);
    },
    async get(profileId, id) {
      const found = state.workouts.get(id);
      return found && found.profileId === profileId ? cloneJson(found) : null;
    },
    async listCompleted(profileId, filter = {}) {
      return completed(profileId)
        .filter((w) => filter.planId === undefined || w.planId === filter.planId)
        .filter((w) => filter.exerciseId === undefined || hasExercise(w, filter.exerciseId))
        .map((w) => cloneJson(w));
    },
    async exerciseSessions(profileId, exerciseId, { limit } = {}) {
      const sessions = completed(profileId)
        .filter((w) => hasExercise(w, exerciseId))
        .map(
          (w): ExerciseSession => ({
            workoutId: w.id,
            completedAt: w.completedAt as string,
            phase: w.phase,
            cycleNumber: w.cycleNumber,
            planId: w.planId,
            targetRir:
              w.exercises.find((e) => e.exerciseId === exerciseId)?.target?.targetRir ?? null,
            sets: cloneJson(
              w.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets),
            ),
          }),
        );
      return limit === undefined ? sessions : sessions.slice(0, limit);
    },
  };
}
