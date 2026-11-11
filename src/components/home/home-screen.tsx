import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { useT } from '@/i18n';
import { selectDeloadAdvice, selectHomeSummary } from '@/state/selectors';
import { WorkoutInProgressError } from '@/state/errors';
import { useAppStore } from '@/state/app-store-context';

import { Button, Card, Screen, Text } from '../ui';
import { CycleSummary } from './cycle-summary';
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
};

/** Runs a store action; a failure shows a localized message instead of crashing. */
export type RunAction = (action: () => Promise<unknown>, next?: () => void) => void;

/** Home (SPEC §10): resume or next workout, cycle summary with deload advice, recent workouts. */
export function HomeScreen({ onOpenWorkout, onOpenWorkoutDetail, onNewPlan, onOpenPlan }: HomeScreenProps) {
  const t = useT();
  const summary = useAppStore(selectHomeSummary);
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
