import { WorkoutNotFoundError, type WorkoutDraft } from '@/data/repositories';
import { completeSession, weekTargetRir } from '@/domain/cycle';
import type { Equipment } from '@/domain/exercise';
import { dropSetLoad } from '@/domain/metrics';
import { supersetLayout } from '@/domain/plan';
import { restSecondsFor } from '@/domain/rest-timer';
import { newRecords } from '@/domain/stats';
import { warmupSets } from '@/domain/warmup';
import { buildWorkoutExercises, targetRepsPlaceholder } from '@/domain/workout-builder';
import {
  canCompleteWorkout,
  finalizeExercises,
  hasSetErrors,
  validateNote,
  validateSet,
  validateSetOrder,
  WORKOUT_LIMITS,
  workoutSummary,
  type LoggedSet,
  type SetErrors,
  type Workout,
  type WorkoutExercise,
} from '@/domain/workout';

import {
  NoActivePlanError,
  NoteValidationError,
  NothingLoggedError,
  NoWorkoutInProgressError,
  PlanWorkoutNotFoundError,
  UnknownExerciseError,
  WorkoutIndexError,
  WorkoutInProgressError,
  WorkoutSetOrderError,
  WorkoutValidationError,
  type WorkoutNoteIssue,
  type WorkoutSetIssue,
} from '../errors';
import {
  selectActivePlan,
  selectBarKg,
  selectExerciseById,
  selectIncrement,
  selectExerciseSessions,
  selectSuggestions,
  selectWorkoutSuggestions,
  formulaOf,
} from '../selectors';
import type { AppState, StoreContext } from '../types';

export type WorkoutActions = Pick<
  AppState,
  | 'startPlanWorkout'
  | 'startFreeWorkout'
  | 'updateSet'
  | 'toggleSetDone'
  | 'setSetKind'
  | 'addSet'
  | 'removeSet'
  | 'addExercise'
  | 'removeExercise'
  | 'replaceExercise'
  | 'setExerciseNote'
  | 'setWorkoutNotes'
  | 'discardWorkout'
  | 'finishWorkout'
  | 'clearLastFinish'
  | 'addDropSet'
  | 'addWarmupSets'
  | 'repeatWorkout'
  | 'amendWorkout'
  | 'deleteWorkout'
>;

const emptySet = (): LoggedSet => ({ kind: 'working', weightKg: null, reps: null, rir: null, done: false });

function draftOf(workout: Workout): WorkoutDraft {
  return {
    planId: workout.planId,
    planWorkoutId: workout.planWorkoutId,
    name: workout.name,
    phase: workout.phase,
    cycleNumber: workout.cycleNumber,
    cycleWeek: workout.cycleWeek,
    startedAt: workout.startedAt,
    notes: workout.notes,
    exercises: workout.exercises,
  };
}

const validInt = (v: number | null, min: number, max: number) =>
  v === null || (Number.isInteger(v) && v >= min && v <= max);

/**
 * What can be stored of a draft: the repository rejects out-of-range values, but a half-typed
 * value (reps "0", weight 1e6) must not break logging. Such values stay in memory only.
 */
function storable(workout: Workout): Workout {
  const { weightKg, reps, rir } = WORKOUT_LIMITS;
  const exercises = workout.exercises.map((exercise) => ({
    ...exercise,
    sets: exercise.sets.map((s) => {
      const ok =
        (s.weightKg === null || (s.weightKg >= weightKg.min && s.weightKg <= weightKg.max)) &&
        validInt(s.reps, reps.min, reps.max) &&
        validInt(s.rir, rir.min, rir.max);
      if (ok) return s;
      return {
        ...s,
        weightKg: s.weightKg !== null && s.weightKg >= weightKg.min && s.weightKg <= weightKg.max ? s.weightKg : null,
        reps: validInt(s.reps, reps.min, reps.max) ? s.reps : null,
        rir: validInt(s.rir, rir.min, rir.max) ? s.rir : null,
        done: false,
      };
    }),
  }));
  return { ...workout, exercises };
}

function withExercise(workout: Workout, index: number, change: (e: WorkoutExercise) => WorkoutExercise): Workout {
  const exercise = workout.exercises[index];
  if (!exercise) throw new WorkoutIndexError(index);
  const changed = change(exercise);
  if (changed === exercise) return workout; // nothing to do: no state change, no write
  const exercises = workout.exercises.slice();
  exercises[index] = changed;
  return { ...workout, exercises };
}

function withSet(
  workout: Workout,
  exerciseIndex: number,
  setIndex: number,
  change: (set: LoggedSet) => LoggedSet,
): Workout {
  return withExercise(workout, exerciseIndex, (exercise) => {
    const set = exercise.sets[setIndex];
    if (!set) throw new WorkoutIndexError(exerciseIndex, setIndex);
    const sets = exercise.sets.slice();
    sets[setIndex] = change(set);
    return { ...exercise, sets };
  });
}

function checkNote(text: string) {
  const reason = validateNote(text);
  if (reason) throw new NoteValidationError(reason);
}

export function createWorkoutActions(ctx: StoreContext): WorkoutActions {
  const { repos, get, set, now, requireReady, enqueue, rest } = ctx;

  const equipmentOf = (exerciseId: string): Equipment =>
    selectExerciseById(get(), exerciseId)?.equipment ?? 'other';

  function requireKnown(exerciseId: string) {
    if (!selectExerciseById(get(), exerciseId)) throw new UnknownExerciseError(exerciseId);
  }

  /** Persists a draft behind every earlier write; reloads the stored draft when the write fails. */
  function persist(profileId: number, workout: Workout): Promise<void> {
    return enqueue(async () => {
      try {
        await repos.workouts.saveDraft(profileId, draftOf(storable(workout)));
      } catch (error) {
        set({ currentWorkout: await repos.workouts.getInProgress(profileId) });
        throw error;
      }
    });
  }

  /** Applies a synchronous change to the in-progress workout, then persists it. */
  async function mutate(
    change: (workout: Workout) => Workout,
    afterSet?: (next: Workout) => void,
  ): Promise<void> {
    const profile = requireReady();
    const current = get().currentWorkout;
    if (!current) throw new NoWorkoutInProgressError();
    const next = change(current);
    if (next === current) return;
    set({ currentWorkout: next });
    afterSet?.(next);
    await persist(profile.id, next);
  }

  /** Starts the rest timer after a set was marked done (SPEC-v3 §1.2; superset rule of §4.1). */
  function startRestAfter(workout: Workout, exerciseIndex: number, setIndex: number) {
    const block = supersetLayout(workout.exercises).find((b) => b.indices.includes(exerciseIndex));
    if (block && block.label !== null && block.indices[block.indices.length - 1] !== exerciseIndex) return;
    const settings = get().settings;
    if (!settings) return;
    const seconds = restSecondsFor(workout.exercises[exerciseIndex].target?.restSeconds, settings.defaultRestSeconds);
    rest.start(workout, exerciseIndex, setIndex, seconds);
  }

  async function start(
    profileId: number,
    build: () => Omit<WorkoutDraft, 'startedAt' | 'notes'>,
  ): Promise<Workout> {
    return enqueue(async () => {
      if (get().currentWorkout) throw new WorkoutInProgressError();
      const draft: WorkoutDraft = { ...build(), startedAt: now().toISOString(), notes: '' };
      const saved = await repos.workouts.saveDraft(profileId, draft);
      set({ currentWorkout: saved });
      return saved;
    });
  }

  return {
    async startPlanWorkout(planWorkoutId) {
      const profile = requireReady();
      return start(profile.id, () => {
        const plan = selectActivePlan(get());
        if (!plan) throw new NoActivePlanError();
        const planWorkout =
          planWorkoutId === undefined
            ? (plan.workouts[plan.cycleState.nextWorkoutIndex] ?? plan.workouts[0])
            : plan.workouts.find((w) => w.id === planWorkoutId);
        if (!planWorkout) throw new PlanWorkoutNotFoundError(planWorkoutId ?? '');
        const suggestions = selectSuggestions(get(), plan.id, planWorkout.id);
        return {
          planId: plan.id,
          planWorkoutId: planWorkout.id,
          name: planWorkout.name,
          phase: plan.cycleState.phase,
          cycleNumber: plan.cycleState.cycleNumber,
          cycleWeek: plan.cycleState.week,
          exercises: buildWorkoutExercises(planWorkout, suggestions, {
            targetRir: weekTargetRir(plan.cycle, plan.cycleState),
          }),
        };
      });
    },

    async startFreeWorkout(name) {
      const profile = requireReady();
      return start(profile.id, () => ({
        planId: null,
        planWorkoutId: null,
        name: name.trim(),
        phase: 'load',
        cycleNumber: null,
        cycleWeek: null,
        exercises: [],
      }));
    },

    updateSet(exerciseIndex, setIndex, patch) {
      return mutate((workout) =>
        withSet(workout, exerciseIndex, setIndex, (current) => {
          const changed: LoggedSet = { ...current };
          if (patch.weightKg !== undefined) changed.weightKg = patch.weightKg;
          if (patch.reps !== undefined) changed.reps = patch.reps;
          if (patch.rir !== undefined) changed.rir = patch.rir;
          // A done set stays done only while it is still valid.
          if (changed.done && hasSetErrors(validateSet(changed, equipmentOf(workout.exercises[exerciseIndex].exerciseId)))) {
            changed.done = false;
          }
          return changed;
        }),
      );
    },

    async toggleSetDone(exerciseIndex, setIndex) {
      let errors: SetErrors = {};
      let becameDone = false;
      await mutate(
        (workout) =>
          withSet(workout, exerciseIndex, setIndex, (current) => {
            if (current.done) return { ...current, done: false };
            const exercise = workout.exercises[exerciseIndex];
            let candidate = current;
            if (candidate.reps === null && exercise.planExerciseId !== null) {
              const suggestion = selectWorkoutSuggestions(get())[exercise.planExerciseId];
              const placeholder = suggestion ? targetRepsPlaceholder(suggestion, setIndex) : null;
              if (placeholder !== null) candidate = { ...candidate, reps: placeholder };
            }
            errors = validateSet(candidate, equipmentOf(exercise.exerciseId));
            if (hasSetErrors(errors)) return current;
            if (candidate.kind === 'drop') {
              // Only done sets count when the workout is finished, so a drop set needs a done parent.
              const doneOrThis = exercise.sets.filter((s, i) => s.done || i === setIndex);
              const position = doneOrThis.indexOf(current);
              if (validateSetOrder(doneOrThis).some((issue) => issue.index === position)) {
                throw new WorkoutSetOrderError(exerciseIndex, setIndex);
              }
            }
            becameDone = true;
            return { ...candidate, done: true };
          }),
        (next) => {
          if (becameDone) startRestAfter(next, exerciseIndex, setIndex);
        },
      );
      return errors;
    },

    // Toggles working <-> warm-up; drop sets are created by `addDropSet` and keep their kind.
    setSetKind: (exerciseIndex, setIndex, kind) =>
      mutate((workout) =>
        withSet(workout, exerciseIndex, setIndex, (current) =>
          current.kind === 'drop' || kind === 'drop' || current.kind === kind ? current : { ...current, kind },
        ),
      ),

    addDropSet: (exerciseIndex, setIndex) =>
      mutate((workout) =>
        withExercise(workout, exerciseIndex, (exercise) => {
          const parent = exercise.sets[setIndex];
          if (!parent) throw new WorkoutIndexError(exerciseIndex, setIndex);
          if (parent.kind === 'warmup') throw new WorkoutSetOrderError(exerciseIndex, setIndex);
          let at = setIndex + 1;
          while (exercise.sets[at]?.kind === 'drop') at += 1;
          const drop: LoggedSet = {
            kind: 'drop',
            weightKg:
              parent.weightKg === null ? null : dropSetLoad(parent.weightKg, selectIncrement(get(), exercise.exerciseId)),
            reps: null,
            rir: null,
            done: false,
          };
          return { ...exercise, sets: [...exercise.sets.slice(0, at), drop, ...exercise.sets.slice(at)] };
        }),
      ),

    async addWarmupSets(exerciseIndex) {
      let added = false;
      await mutate((workout) =>
        withExercise(workout, exerciseIndex, (exercise) => {
          const first = exercise.sets.find((s) => s.kind === 'working');
          if (!first || first.weightKg === null) return exercise;
          const state = get();
          const bar = equipmentOf(exercise.exerciseId) === 'barbell' ? selectBarKg(state, exercise.exerciseId) : 0;
          const ramp = warmupSets(first.weightKg, selectIncrement(state, exercise.exerciseId), bar);
          if (ramp.length === 0) return exercise;
          const kept = exercise.sets.filter((s) => s.kind !== 'warmup' || s.done);
          const at = kept.findIndex((s) => s.kind !== 'warmup');
          const warmups: LoggedSet[] = ramp.map((w) => ({
            kind: 'warmup',
            weightKg: w.weightKg,
            reps: w.reps,
            rir: null,
            done: false,
          }));
          added = true;
          return { ...exercise, sets: [...kept.slice(0, at), ...warmups, ...kept.slice(at)] };
        }),
      );
      return added;
    },

    async repeatWorkout(workoutId) {
      const profile = requireReady();
      const source = get().workouts.find((w) => w.id === workoutId);
      if (!source) throw new WorkoutNotFoundError(workoutId);
      return start(profile.id, () => ({
        planId: null,
        planWorkoutId: null,
        name: source.name,
        phase: 'load',
        cycleNumber: null,
        cycleWeek: null,
        exercises: source.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          planExerciseId: null,
          target: null,
          supersetGroup: e.supersetGroup ?? null,
          note: '',
          sets: e.sets.map((s) => ({ kind: s.kind, weightKg: s.weightKg, reps: null, rir: null, done: false })),
        })),
      }));
    },

    addSet: (exerciseIndex) =>
      mutate((workout) =>
        withExercise(workout, exerciseIndex, (exercise) => {
          const previous = exercise.sets[exercise.sets.length - 1];
          return { ...exercise, sets: [...exercise.sets, { ...emptySet(), weightKg: previous?.weightKg ?? null }] };
        }),
      ),

    removeSet: (exerciseIndex, setIndex) =>
      mutate((workout) =>
        withExercise(workout, exerciseIndex, (exercise) => {
          if (!exercise.sets[setIndex]) throw new WorkoutIndexError(exerciseIndex, setIndex);
          return { ...exercise, sets: exercise.sets.filter((_, i) => i !== setIndex) };
        }),
      ),

    addExercise: (exerciseId) =>
      mutate((workout) => {
        requireKnown(exerciseId);
        const added: WorkoutExercise = { exerciseId, planExerciseId: null, target: null, note: '', sets: [emptySet()] };
        return { ...workout, exercises: [...workout.exercises, added] };
      }),

    removeExercise: (exerciseIndex) =>
      mutate((workout) => {
        if (!workout.exercises[exerciseIndex]) throw new WorkoutIndexError(exerciseIndex);
        return { ...workout, exercises: workout.exercises.filter((_, i) => i !== exerciseIndex) };
      }),

    replaceExercise: (exerciseIndex, exerciseId) =>
      mutate((workout) => {
        requireKnown(exerciseId);
        return withExercise(workout, exerciseIndex, (exercise) => ({
          ...exercise,
          exerciseId,
          sets: exercise.sets.map((s) => ({ ...s, weightKg: null, reps: null, rir: null, done: false })),
        }));
      }),

    setExerciseNote: (exerciseIndex, note) =>
      mutate((workout) => {
        checkNote(note);
        return withExercise(workout, exerciseIndex, (exercise) => ({ ...exercise, note }));
      }),

    setWorkoutNotes: (notes) =>
      mutate((workout) => {
        checkNote(notes);
        return { ...workout, notes };
      }),

    async discardWorkout() {
      const profile = requireReady();
      const current = get().currentWorkout;
      if (!current) throw new NoWorkoutInProgressError();
      set({ currentWorkout: null });
      rest.clear();
      await enqueue(() => repos.workouts.delete(profile.id, current.id));
    },

    async finishWorkout() {
      const profile = requireReady();
      const pending = get().currentWorkout;
      if (!pending) throw new NoWorkoutInProgressError();
      if (!canCompleteWorkout(pending.exercises)) throw new NothingLoggedError();

      return enqueue(async () => {
        const workout = get().currentWorkout;
        if (!workout) throw new NoWorkoutInProgressError();
        if (!canCompleteWorkout(workout.exercises)) throw new NothingLoggedError();

        const completed = await repos.workouts.complete(profile.id, workout.id, {
          exercises: finalizeExercises(workout.exercises),
          notes: workout.notes,
          completedAt: now().toISOString(),
        });
        const records = newRecords(completed, (id) => selectExerciseSessions(get(), id), formulaOf(get()));
        const summary = workoutSummary(completed);

        let plans = get().plans;
        let completedCycle = get().completedCycle;
        const plan = plans.find((p) => p.id === completed.planId);
        const index = plan ? plan.workouts.findIndex((w) => w.id === completed.planWorkoutId) : -1;
        if (plan && index >= 0) {
          const advanced = await repos.plans.setCycleState(
            profile.id,
            plan.id,
            completeSession(plan, plan.cycleState, index),
          );
          plans = plans.map((p) => (p.id === advanced.id ? advanced : p));
          if (advanced.cycleState.cycleNumber > plan.cycleState.cycleNumber) {
            completedCycle = { planId: plan.id, cycleNumber: plan.cycleState.cycleNumber };
          }
        }
        rest.clear();

        const lastFinish = { workout: completed, summary, records };
        set({
          plans,
          currentWorkout: null,
          workouts: await repos.workouts.listCompleted(profile.id),
          deloadAdviceDismissed: false,
          lastFinish,
          completedCycle,
        });
        return lastFinish;
      });
    },

    clearLastFinish() {
      set({ lastFinish: null });
    },

    async amendWorkout(id, changes) {
      const profile = requireReady();
      if (!get().workouts.some((w) => w.id === id)) throw new WorkoutNotFoundError(id);

      const sets: WorkoutSetIssue[] = [];
      const notes: WorkoutNoteIssue[] = [];
      changes.exercises.forEach((exercise, exerciseIndex) => {
        exercise.sets.forEach((s, setIndex) => {
          if (!s.done) return;
          const errors = validateSet(s, equipmentOf(exercise.exerciseId));
          if (hasSetErrors(errors)) sets.push({ exerciseIndex, setIndex, errors });
        });
        if (validateNote(exercise.note)) notes.push({ exerciseIndex, code: 'tooLong' });
      });
      if (validateNote(changes.notes)) notes.push({ exerciseIndex: null, code: 'tooLong' });
      if (sets.length > 0 || notes.length > 0) throw new WorkoutValidationError(sets, notes);

      const amended = await repos.workouts.amend(profile.id, id, {
        exercises: finalizeExercises(changes.exercises),
        notes: changes.notes,
      });
      set({ workouts: get().workouts.map((w) => (w.id === id ? amended : w)) });
      return amended;
    },

    async deleteWorkout(id) {
      const profile = requireReady();
      if (!get().workouts.some((w) => w.id === id)) throw new WorkoutNotFoundError(id);
      await repos.workouts.delete(profile.id, id);
      set({ workouts: get().workouts.filter((w) => w.id !== id) });
    },
  };
}
