import { supersetLayout } from '@/domain/plan';
import { adjustRest as adjustTimer, startRest } from '@/domain/rest-timer';
import type { Workout } from '@/domain/workout';

import type { AppState, RestControl, RestNotifier } from '../types';

export type RestActions = Pick<AppState, 'adjustRest' | 'skipRest'>;

type Deps = {
  get: () => AppState;
  set: (partial: Partial<AppState>) => void;
  now: () => Date;
  notifier?: RestNotifier;
};

/**
 * The next set to do after `(exerciseIndex, setIndex)` was completed: the next round of its
 * superset (or the exercise's next set), then the following exercises. Falls back to the set
 * itself when nothing is left. `setNumber` is the 1-based position of the set in its exercise.
 */
export function nextSetInfo(
  workout: Workout,
  exerciseIndex: number,
  setIndex: number,
): { exerciseId: string; setNumber: number } {
  const blocks = supersetLayout(workout.exercises);
  const at = blocks.findIndex((b) => b.indices.includes(exerciseIndex));
  for (let b = Math.max(at, 0); b < blocks.length; b++) {
    const { indices } = blocks[b];
    const rounds = Math.max(...indices.map((i) => workout.exercises[i].sets.length));
    for (let round = b === at ? setIndex + 1 : 0; round < rounds; round++) {
      for (const i of indices) {
        const set = workout.exercises[i].sets[round];
        if (set && !set.done) return { exerciseId: workout.exercises[i].exerciseId, setNumber: round + 1 };
      }
    }
  }
  return { exerciseId: workout.exercises[exerciseIndex].exerciseId, setNumber: setIndex + 1 };
}

/** The rest timer state machine and its notifications. A notifier failure never propagates. */
export function createRest({ get, set, now, notifier }: Deps): { control: RestControl; actions: RestActions } {
  const guarded = (call: () => void | Promise<void>) => {
    try {
      void Promise.resolve(call()).catch(() => undefined);
    } catch {
      // A broken notifier must not break logging.
    }
  };
  const enabled = () => notifier !== undefined && get().settings?.restNotifications === true;

  function schedule(endsAt: number, workout: Workout | null, exerciseIndex: number, setIndex: number) {
    if (!enabled() || !workout || !workout.exercises[exerciseIndex]) return;
    const info = nextSetInfo(workout, exerciseIndex, setIndex);
    guarded(() => notifier!.scheduleRestEnd(endsAt, info));
  }

  function cancel() {
    if (enabled()) guarded(() => notifier!.cancelRestEnd());
  }

  const control: RestControl = {
    start(workout, exerciseIndex, setIndex, seconds) {
      if (!(seconds > 0)) return;
      const timer = startRest(now().getTime(), seconds);
      set({ restTimer: { timer, exerciseIndex, setIndex } });
      schedule(timer.endsAt, workout, exerciseIndex, setIndex);
    },
    clear() {
      if (get().restTimer === null) return;
      set({ restTimer: null });
      cancel();
    },
    cancelNotification() {
      if (get().restTimer !== null) cancel();
    },
  };

  const actions: RestActions = {
    adjustRest(deltaSeconds) {
      const current = get().restTimer;
      if (!current) return;
      const nowMs = now().getTime();
      const timer = adjustTimer(current.timer, deltaSeconds, nowMs);
      set({ restTimer: { ...current, timer } });
      if (timer.endsAt > nowMs) schedule(timer.endsAt, get().currentWorkout, current.exerciseIndex, current.setIndex);
      else cancel();
    },
    skipRest: control.clear,
  };

  return { control, actions };
}
