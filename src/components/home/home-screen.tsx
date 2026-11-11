import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { useT } from '@/i18n';
import { selectDeloadAdvice, selectHomeSummary } from '@/state/selectors';
import { selectBackupReminder, selectWeekStreak } from '@/state/selectors-v3';
import { WorkoutInProgressError } from '@/state/errors';
import { useAppStore } from '@/state/app-store-context';

import { Button, Card, Screen, Text } from '../ui';
import { CycleSummary } from './cycle-summary';
import { BackupReminderCard, CycleCompleteBanner, StreakLine } from './home-notices';
import { NextWorkoutCard } from './next-workout-card';
import { RecentWorkouts } from './recent-workouts';
import { ResumeCard } from './resume-card';

export type NewPlanKind = 'templates' | 'import' | 'scratch';

export type HomeScreenProps = {
  /** Opens the Workout tab. */
  onOpenWorkout: () => void;
  /** Opens the detail of a completed workout (`history/[id]`). */
  onOpenWorkoutDetail: (id: number) => void;
  /** Starts the way to create a plan: template, import or from scratch. */
  onNewPlan: (kind: NewPlanKind) => void;
  /** Opens the Plan tab. */
  onOpenPlan: () => void;
  /** Opens a cycle's report (`/plans/<id>/cycles/<n>`). */
  onOpenCycleReport?: (planId: number, cycleNumber: number) => void;
  /** Opens Settings (`/settings`), where the backup lives. */
  onOpenSettings?: () => void;
  /** The reference time for the streak and the backup reminder (defaults to the current time). */
  now?: Date;
};

/** Runs a store action; a failure shows a localized message instead of crashing. */
export type RunAction = (action: () => Promise<unknown>, next?: () => void) => void;

/** Home (SPEC §10): resume or next workout, cycle summary with deload advice, recent workouts. */
export function HomeScreen({
  onOpenWorkout,
  onOpenWorkoutDetail,
  onNewPlan,
  onOpenPlan,
  onOpenCycleReport,
  onOpenSettings,
  now,
}: HomeScreenProps) {
  const t = useT();
  const clock = useMemo(() => now ?? new Date(), [now]);
  const summary = useAppStore(selectHomeSummary);
  const streak = useAppStore((s) => selectWeekStreak(s, clock));
  const backupDue = useAppStore((s) => selectBackupReminder(s, clock));
  const completedCycle = useAppStore((s) => s.completedCycle);
  const dismissCompletedCycle = useAppStore((s) => s.dismissCompletedCycle);
  const advice = useAppStore(selectDeloadAdvice);
  const startPlanWorkout = useAppStore((s) => s.startPlanWorkout);
  const startFreeWorkout = useAppStore((s) => s.startFreeWorkout);
  const [error, setError] = useState<string | null>(null);

  const run: RunAction = async (action, next) => {
    setError(null);
    try {
      await action();
      next?.();
    } catch (cause) {
      setError(t(cause instanceof WorkoutInProgressError ? 'home.error.workoutInProgress' : 'home.error.generic'));
    }
  };

  const inProgress = summary.inProgress !== null;
  const plan = summary.activePlan;

  return (
    <Screen title={t('home.title')} testID="screen-home">
      {error ? (
        <Text tone="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      {completedCycle ? (
        <CycleCompleteBanner
          completed={completedCycle}
          onOpenReport={() => onOpenCycleReport?.(completedCycle.planId, completedCycle.cycleNumber)}
          onDismiss={dismissCompletedCycle}
        />
      ) : null}

      {summary.inProgress ? <ResumeCard workout={summary.inProgress} onPress={onOpenWorkout} /> : null}

      {plan ? (
        <View style={styles.stack}>
          {!inProgress && summary.nextWorkout ? (
            <NextWorkoutCard
              workout={summary.nextWorkout}
              deload={summary.cycle?.phase === 'deload'}
              onStart={() => run(() => startPlanWorkout(), onOpenWorkout)}
            />
          ) : null}
          {summary.cycle ? (
            <CycleSummary
              plan={plan}
              cycle={summary.cycle}
              advice={advice}
              run={run}
              onOpenPlan={onOpenPlan}
            />
          ) : null}
        </View>
      ) : (
        <Card>
          <NoPlanContent onNewPlan={onNewPlan} />
        </Card>
      )}

      <StreakLine weeks={streak} />

      {!inProgress ? (
        <Button
          variant="secondary"
          label={t('home.freeWorkout')}
          onPress={() => run(() => startFreeWorkout(t('home.freeWorkout')), onOpenWorkout)}
        />
      ) : null}

      {summary.recentWorkouts.length > 0 ? (
        <RecentWorkouts workouts={summary.recentWorkouts} onOpen={onOpenWorkoutDetail} />
      ) : null}

      {backupDue ? <BackupReminderCard onOpenSettings={() => onOpenSettings?.()} /> : null}
    </Screen>
  );
}

function NoPlanContent({ onNewPlan }: { onNewPlan: (kind: NewPlanKind) => void }) {
  const t = useT();
  return (
    <View style={styles.stack}>
      <Text variant="heading">{t('home.noPlan.title')}</Text>
      <Text tone="secondary">{t('home.noPlan.message')}</Text>
      <Button label={t('home.noPlan.template')} onPress={() => onNewPlan('templates')} />
      <Button variant="secondary" label={t('home.noPlan.import')} onPress={() => onNewPlan('import')} />
      <Button variant="secondary" label={t('home.noPlan.scratch')} onPress={() => onNewPlan('scratch')} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
});
