import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { PLAN_LIMITS, type PlanExercise, type PlanWorkout } from '@/domain/plan';
import { useI18n } from '@/i18n';

import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { ExerciseRow } from './exercise-row';
import { IconButton } from './icon-button';

export type WorkoutCardProps = {
  workout: PlanWorkout;
  /** Position of the workout in the plan (0-based). */
  index: number;
  isFirst: boolean;
  isLast: boolean;
  errors: Record<string, string>;
  /** Display name of a library or custom exercise, by exercise id. */
  exerciseLabel: (exerciseId: string) => string;
  onRename: (name: string) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  onAddExercise: () => void;
  onChangeExercise: (exerciseIndex: number, next: PlanExercise) => void;
  onMoveExercise: (exerciseIndex: number, delta: -1 | 1) => void;
  onRemoveExercise: (exerciseIndex: number) => void;
  onLoadInvalid: (planExerciseId: string, invalid: boolean) => void;
  /** Plan exercise ids that start expanded (added in this editing session). */
  newExerciseIds: ReadonlySet<string>;
};

/** One workout of the plan: its name, ↑/↓/remove, its exercises and the Add exercise button. */
export function WorkoutCard({
  workout,
  index,
  isFirst,
  isLast,
  errors,
  exerciseLabel,
  onRename,
  onMove,
  onRemove,
  onAddExercise,
  onChangeExercise,
  onMoveExercise,
  onRemoveExercise,
  onLoadInvalid,
  newExerciseIds,
}: WorkoutCardProps) {
  const { t } = useI18n();
  const path = `workouts[${index}]`;
  const name = workout.name.trim() || t('planEditor.workoutFallback', { number: index + 1 });
  const exercisesError = errors[`${path}.exercises`];

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.nameField}>
          <TextField
            label={t('planEditor.workoutNameLabel', { number: index + 1 })}
            value={workout.name}
            onChangeText={onRename}
            error={errors[`${path}.name`]}
          />
        </View>
        <IconButton glyph="↑" label={t('planEditor.moveUp', { name })} disabled={isFirst} onPress={() => onMove(-1)} />
        <IconButton glyph="↓" label={t('planEditor.moveDown', { name })} disabled={isLast} onPress={() => onMove(1)} />
        <IconButton glyph="✕" label={t('planEditor.removeWorkout', { name })} onPress={onRemove} />
      </View>

      {workout.exercises.length === 0 ? (
        <Text tone="secondary">{t('planEditor.noExercises')}</Text>
      ) : (
        workout.exercises.map((exercise, exerciseIndex) => (
          <ExerciseRow
            key={exercise.id}
            exercise={exercise}
            name={exerciseLabel(exercise.exerciseId)}
            path={`${path}.exercises[${exerciseIndex}]`}
            errors={errors}
            isFirst={exerciseIndex === 0}
            isLast={exerciseIndex === workout.exercises.length - 1}
            onChange={(next) => onChangeExercise(exerciseIndex, next)}
            onMove={(delta) => onMoveExercise(exerciseIndex, delta)}
            onRemove={() => onRemoveExercise(exerciseIndex)}
            onLoadInvalid={(invalid) => onLoadInvalid(exercise.id, invalid)}
            startExpanded={newExerciseIds.has(exercise.id)}
          />
        ))
      )}
      {exercisesError ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {exercisesError}
        </Text>
      ) : null}

      <Button
        variant="secondary"
        label={t('planEditor.addExercise')}
        accessibilityLabel={t('planEditor.addExerciseTo', { workout: name })}
        disabled={workout.exercises.length >= PLAN_LIMITS.exercisesPerWorkout.max}
        onPress={onAddExercise}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  nameField: { flex: 1 },
});
