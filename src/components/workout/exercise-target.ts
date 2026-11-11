import type { TFunction } from '@/i18n';

import { repsRange } from './suggestion-text';

export type TargetShape = {
  sets: number;
  repMin: number;
  repMax: number;
  targetRir?: number;
  restSeconds?: number;
};

/**
 * `3 × 8–12 · RIR 2 · 120 s`: only the parts that exist. `sets` overrides the target's (deload).
 */
export function targetLine(
  t: TFunction,
  target: TargetShape,
  sets: number = target.sets,
  /** The target RIR comes from the plan's RIR ramp: "RIR 2 this week". */
  rirThisWeek = false,
): string {
  const parts = [
    t('workout.targetSetsReps', {
      sets,
      reps: repsRange(target.repMin, target.repMax),
    }),
  ];
  if (target.targetRir !== undefined)
    parts.push(
      t(rirThisWeek ? 'workout.targetRirWeek' : 'workout.targetRir', {
        rir: target.targetRir,
      }),
    );
  if (target.restSeconds !== undefined) parts.push(t('workout.targetRest', { seconds: target.restSeconds }));
  return parts.join(' · ');
}
