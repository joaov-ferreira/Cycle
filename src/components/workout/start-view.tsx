import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { weekTargetRir } from '@/domain/cycle';
import type { Plan } from '@/domain/plan';
import { useI18n } from '@/i18n';
import {
  selectActivePlan,
  selectFindExercise,
  selectNextPlanWorkout,
  selectSuggestions,
  useAppStore,
} from '@/state';

import { Chip, EmptyState, useExerciseName } from '../shared';
import { Button, Card, Screen, Text } from '../ui';
import { Badge } from './badge';
import { targetLine } from './exercise-target';
import { suggestionText } from './suggestion-text';
import { useAction } from './use-action';

export type WorkoutStartProps = {
  onNewPlan: () => void;
};

/** Nothing in progress (SPEC §7.2): the suggested next workout of the plan, or a free workout. */
export function WorkoutStart({ onNewPlan }: WorkoutStartProps) {
  const i18n = useI18n();
  const { t } = i18n;
  const plan = useAppStore(selectActivePlan);
  const next = useAppStore(selectNextPlanWorkout);
  const startPlanWorkout = useAppStore((s) => s.startPlanWorkout);
  const startFreeWorkout = useAppStore((s) => s.startFreeWorkout);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const { error, run } = useAction();

  const selectedId =
    plan?.workouts.some((w) => w.id === chosenId) ? chosenId : (next?.id ?? null);

  const freeWorkout = (
    <Button
      variant="secondary"
      label={t('workout.freeWorkout')}
      onPress={() => void run(() => startFreeWorkout(t('workout.freeWorkoutName')))}
    />
  );

  return (
    <Screen title={t('workout.title')} testID="screen-workout">
      {error ? (
        <Text tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {plan && next && selectedId ? (
        <>
          <PlanWorkoutCard
            plan={plan}
            workoutId={selectedId}
            isSuggested={selectedId === next.id}
            onSelect={setChosenId}
            onStart={() => void run(() => startPlanWorkout(selectedId))}
          />
          {freeWorkout}
        </>
      ) : (
        <>
          <EmptyState
            title={t('workout.noPlanTitle')}
            message={t('workout.noPlanMessage')}
            actionLabel={t('workout.createPlan')}
            onAction={onNewPlan}
          />
          {freeWorkout}
        </>
      )}
    </Screen>
  );
}

type PlanWorkoutCardProps = {
  plan: Plan;
  workoutId: string;
  isSuggested: boolean;
  onSelect: (workoutId: string) => void;
  onStart: () => void;
};

function PlanWorkoutCard({ plan, workoutId, isSuggested, onSelect, onStart }: PlanWorkoutCardProps) {
  const i18n = useI18n();
  const { t, formatKg } = i18n;
  const exerciseLabel = useExerciseName();
  const findExercise = useAppStore(selectFindExercise);
  const suggestions = useAppStore((s) => selectSuggestions(s, plan.id, workoutId));
  const workout = plan.workouts.find((w) => w.id === workoutId);
  if (!workout) return null;

  const { cycleNumber, phase, week } = plan.cycleState;
  const deload = phase === 'deload';
  const rampRir = weekTargetRir(plan.cycle, plan.cycleState);

  return (
    <Card testID="next-workout">
      {isSuggested ? (
        <Text variant="caption" tone="secondary">
          {t('workout.nextWorkout')}
        </Text>
      ) : null}
      <View style={styles.titleRow}>
        <Text variant="heading" style={styles.title}>
          {workout.name}
        </Text>
        {deload ? <Badge label={t('workout.deloadBadge')} /> : null}
      </View>
      <Text tone="secondary">
        {t(deload ? 'workout.cycleDeload' : 'workout.cycleLoad', { cycle: cycleNumber, week })}
      </Text>

      {plan.workouts.length > 1 ? (
        <View accessibilityLabel={t('workout.chooseWorkout')} style={styles.chips}>
          {plan.workouts.map((w) => (
            <Chip key={w.id} label={w.name} selected={w.id === workoutId} onPress={() => onSelect(w.id)} />
          ))}
        </View>
      ) : null}

      <View style={styles.exercises}>
        {workout.exercises.map((pe) => {
          const exercise = findExercise(pe.exerciseId);
          const suggestion = suggestions[pe.id];
          return (
            <View key={pe.id} testID={`preview-${pe.id}`} style={styles.exercise}>
              <Text variant="label">{exercise ? exerciseLabel(exercise) : pe.exerciseId}</Text>
              <Text variant="caption" tone="secondary" tabular>
                {targetLine(
                  t,
                  rampRir === undefined ? pe : { ...pe, targetRir: rampRir },
                  suggestion?.sets,
                  rampRir !== undefined,
                )}
              </Text>
              {suggestion ? (
                <>
                  <Text tabular>
                    {suggestion.loadKg === null
                      ? t('workout.chooseLoad')
                      : formatKg(suggestion.loadKg, { minimumFractionDigits: 0 })}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {suggestionText(suggestion, pe, i18n, { deloadLoadFactor: plan.cycle.deloadLoadFactor })}
                  </Text>
                </>
              ) : null}
            </View>
          );
        })}
      </View>

      <Button label={t('workout.startWorkout')} onPress={onStart} />
    </Card>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  title: { flexShrink: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  exercises: { gap: spacing.md, paddingVertical: spacing.sm },
  exercise: { gap: 2 },
});
