import type { Plan } from '@/domain/plan';
import type { TFunction } from '@/i18n';

/** "3 workouts · 2 sessions per week". */
export function planSummary(t: TFunction, plan: Pick<Plan, 'workouts' | 'sessionsPerWeek'>): string {
  return t('plan.summary', {
    workouts: t('plan.workoutsCount', { count: plan.workouts.length }),
    sessions: t('plan.sessionsPerWeekCount', { count: plan.sessionsPerWeek }),
  });
}
