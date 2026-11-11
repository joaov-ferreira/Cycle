/**
 * The cycle wording shared by every screen that shows the cycle (the plan's full cycle card and
 * Home's compact summary), so the two cannot drift apart.
 */
import { cycleTimeline, type CycleConfig, type CycleState, type DeloadAdvice } from '@/domain/cycle';
import type { TFunction } from '@/i18n';

/** `Cycle 2 · Load week 3 of 6` / `Cycle 1 · Deload week 1 of 1`. */
export function cycleStatusText(t: TFunction, cycle: CycleConfig, state: CycleState): string {
  const total = cycleTimeline(cycle, state).filter((cell) => cell.phase === state.phase).length;
  return t(state.phase === 'deload' ? 'plan.cycle.statusDeload' : 'plan.cycle.statusLoad', {
    cycle: state.cycleNumber,
    week: state.week,
    total,
  });
}

/** The sentence that goes with a deload advice, or `null` when there is nothing to say. */
export function adviceText(t: TFunction, advice: DeloadAdvice): string | null {
  switch (advice.kind) {
    case 'upcoming':
      return t('plan.cycle.adviceUpcoming');
    case 'inDeload':
      return t('plan.cycle.adviceInDeload');
    case 'early':
      return t('plan.cycle.adviceEarly', { count: advice.stalledExerciseIds.length });
    case 'none':
      return null;
  }
}
