import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { PLAN_LIMITS, supersetLayout, type PlanExercise, type PlanWorkout } from '@/domain/plan';
import type { ProgramLink, ProgramTemplate } from '@/domain/program';
import { useI18n } from '@/i18n';

import { useTheme } from '../../theme-provider';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { ExerciseRow } from './exercise-row';
import { IconButton } from './icon-button';
import { ProgramBlocks } from './program-blocks';
import { canLinkNext, isLinkedToPrevious, offersLink } from './superset-ops';

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
  onLinkExercise: (exerciseIndex: number) => void;
  onUnlinkExercise: (exerciseIndex: number) => void;
  onLoadInvalid: (planExerciseId: string, invalid: boolean) => void;
  /** Plan exercise ids that start expanded (added in this editing session). */
  newExerciseIds: ReadonlySet<string>;
  /** An id for a program block added now. */
  newBlockId: string;
  findProgram: (id: string) => ProgramTemplate | undefined;
  onAddBlock: (block: ProgramLink) => void;
  onChangeBlock: (blockIndex: number, block: ProgramLink) => void;
  onMoveBlock: (blockIndex: number, delta: -1 | 1) => void;
  onRemoveBlock: (blockIndex: number) => void;
};

function supersetTitle(t: ReturnType<typeof useI18n>['t'], size: number): string {
  if (size >= 4) return t('planEditor.superset.four');
  return size === 3 ? t('planEditor.superset.three') : t('planEditor.superset.two');
}

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
  onLinkExercise,
  onUnlinkExercise,
  onLoadInvalid,
  newExerciseIds,
  newBlockId,
  findProgram,
  onAddBlock,
  onChangeBlock,
  onMoveBlock,
  onRemoveBlock,
}: WorkoutCardProps) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const path = `workouts[${index}]`;
  const name = workout.name.trim() || t('planEditor.workoutFallback', { number: index + 1 });
  const exercisesError = errors[`${path}.exercises`];
  // Rows move between the workout card and a superset group when linked or unlinked, which
  // remounts them: the open/closed state is remembered here, by plan exercise id.
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});

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

      <ProgramBlocks
        workoutName={name}
        path={path}
        blocks={workout.programs ?? []}
        errors={errors}
        newBlockId={newBlockId}
        findProgram={findProgram}
        onAdd={onAddBlock}
        onChange={onChangeBlock}
        onMove={onMoveBlock}
        onRemove={onRemoveBlock}
      />

      {workout.exercises.length === 0 ? (
        (workout.programs ?? []).length === 0 ? <Text tone="secondary">{t('planEditor.noExercises')}</Text> : null
      ) : (
        supersetLayout(workout.exercises).map((block) => {
          const rows = block.indices.map((exerciseIndex) => {
            const exercise = workout.exercises[exerciseIndex];
            return (
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
                startExpanded={expandedById[exercise.id] ?? newExerciseIds.has(exercise.id)}
                onExpandedChange={(open) => setExpandedById((previous) => ({ ...previous, [exercise.id]: open }))}
                link={
                  offersLink(workout.exercises, exerciseIndex)
                    ? {
                        disabled: !canLinkNext(workout.exercises, exerciseIndex),
                        onLink: () => onLinkExercise(exerciseIndex),
                      }
                    : undefined
                }
                onUnlink={
                  isLinkedToPrevious(workout.exercises, exerciseIndex)
                    ? () => onUnlinkExercise(exerciseIndex)
                    : undefined
                }
              />
            );
          });
          if (block.label === null) return rows;
          const title = supersetTitle(t, block.indices.length);
          return (
            <View
              key={`group-${workout.exercises[block.indices[0]].id}`}
              testID="superset-group"
              accessibilityLabel={title}
              style={[styles.group, { borderColor: colors.accentText }]}>
              <Text variant="label" tone="accent" accessibilityRole="header">
                {title}
              </Text>
              {rows}
            </View>
          );
        })
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
  group: { borderLeftWidth: 3, paddingLeft: spacing.sm, gap: spacing.sm },
});
