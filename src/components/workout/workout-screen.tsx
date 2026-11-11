import { useAppStore } from '@/state';

import { WorkoutLogger } from './logger-view';
import { WorkoutStart } from './start-view';
import { WorkoutSummary } from './summary-view';

export type WorkoutScreenProps = {
  /** The user wants to create a plan (no active plan). */
  onNewPlan: () => void;
  /** Opens the history detail of a workout (from the summary). */
  onOpenWorkoutDetail: (id: number) => void;
};

/**
 * Workout tab (SPEC §7): the workout in progress when there is one, else the summary of the one
 * just finished, else the start view.
 */
export function WorkoutScreen({ onNewPlan, onOpenWorkoutDetail }: WorkoutScreenProps) {
  const current = useAppStore((s) => s.currentWorkout);
  const lastFinish = useAppStore((s) => s.lastFinish);

  if (current) return <WorkoutLogger workout={current} />;
  if (lastFinish) return <WorkoutSummary result={lastFinish} onOpenWorkoutDetail={onOpenWorkoutDetail} />;
  return <WorkoutStart onNewPlan={onNewPlan} />;
}
