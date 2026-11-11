import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import type { Plan, PlanExercise, PlanWorkout } from '@/domain/plan';
import type { Suggestion } from '@/domain/progression';
import { useI18n } from '@/i18n';
import { selectActivePlan, selectFindExercise, selectSuggestions, useAppStore } from '@/state';

import { useExerciseName } from '../shared';
import { Card, Text } from '../ui';
import { PlanBadge } from './plan-badge';

/** The workouts of a plan with their exercises, targets and next-load suggestions. */
export function PlanWorkouts({ plan }: { plan: Plan }) {
  const { t } = useI18n();
  const nextId = useAppStore((s) => {
    const active = selectActivePlan(s);
    if (!active || active.id !== plan.id) return null;
    return (active.workouts[active.cycleState.nextWorkoutIndex] ?? active.workouts[0])?.id ?? null;
  });
  return (
    <View style={styles.container}>
      <Text variant="heading">{t('plan.workoutsHeading')}</Text>
      {plan.workouts.map((workout) => (
        <WorkoutBlock key={workout.id} planId={plan.id} workout={workout} isNext={workout.id === nextId} />
      ))}
    </View>
  );
}

function WorkoutBlock({ planId, workout, isNext }: { planId: number; workout: PlanWorkout; isNext: boolean }) {
  const { t } = useI18n();
  const suggestions = useAppStore((s) => selectSuggestions(s, planId, workout.id));
  return (
    <Card testID={`plan-workout-${workout.id}`}>
      <View style={styles.titleRow}>
        <Text variant="heading">{workout.name}</Text>
        {isNext ? <PlanBadge label={t('plan.next')} /> : null}
      </View>
      {workout.exercises.map((exercise) => (
        <ExerciseLine key={exercise.id} exercise={exercise} suggestion={suggestions[exercise.id]} />
      ))}
    </Card>
  );
}

function ExerciseLine({ exercise, suggestion }: { exercise: PlanExercise; suggestion?: Suggestion }) {
  const { t, formatNumber, formatKg } = useI18n();
  const find = useAppStore(selectFindExercise);
  const nameOf = useExerciseName();
  const found = find(exercise.exerciseId);
  const reps =
    exercise.repMin === exercise.repMax
      ? formatNumber(exercise.repMin)
      : t('plan.repRange', { min: exercise.repMin, max: exercise.repMax });

  return (
    <View style={styles.exercise}>
      <Text variant="label">{found ? nameOf(found) : exercise.exerciseId}</Text>
      <View style={styles.detailRow}>
        <Text tone="secondary" tabular>
          {t('plan.target', { sets: exercise.sets, reps })}
        </Text>
        {exercise.targetRir !== undefined ? (
          <Text tone="secondary">{t('plan.targetRir', { value: exercise.targetRir })}</Text>
        ) : null}
        {exercise.restSeconds !== undefined ? (
          <Text tone="secondary" tabular>
            {t('plan.rest', { seconds: exercise.restSeconds })}
          </Text>
        ) : null}
      </View>
      {exercise.note ? (
        <Text tone="secondary" variant="caption">
          {t('plan.noteLabel', { note: exercise.note })}
        </Text>
      ) : null}
      {suggestion ? (
        <View style={styles.detailRow}>
          <Text tone="accent" tabular>
            {suggestion.loadKg === null
              ? t('plan.suggestionChoose')
              : t('plan.suggestionLoad', { load: formatKg(suggestion.loadKg, { minimumFractionDigits: 0 }) })}
          </Text>
          {suggestion.action === 'deload' ? <PlanBadge label={t('plan.deloadMarker')} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  exercise: { gap: spacing.xs, paddingVertical: spacing.xs },
  detailRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.md },
});
