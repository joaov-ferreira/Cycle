import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, spacing } from '@/constants/theme';
import type { Exercise } from '@/domain/exercise';
import type { Suggestion } from '@/domain/progression';
import { canCompleteWorkout, type Workout } from '@/domain/workout';
import { useI18n } from '@/i18n';
import {
  selectActivePlan,
  selectAllExercises,
  selectFindExercise,
  selectWorkoutSuggestions,
  useAppStore,
} from '@/state';

import { ConfirmDialog, ExerciseSelectModal, useExerciseName } from '../shared';
import { useTheme } from '../theme-provider';
import { Button, Text } from '../ui';
import { Badge } from './badge';
import { ExerciseCard } from './exercise-card';
import { NoteField } from './note-field';
import { useAction } from './use-action';

type Picker = { mode: 'add' } | { mode: 'replace'; index: number };

/** The workout in progress (SPEC §7.3): header, one card per exercise, notes, finish and discard. */
export function WorkoutLogger({ workout }: { workout: Workout }) {
  const { colors } = useTheme();
  const { t, formatDate } = useI18n();
  const exerciseLabel = useExerciseName();
  const suggestions: Record<string, Suggestion> = useAppStore(selectWorkoutSuggestions);
  const plan = useAppStore(selectActivePlan);
  const allExercises = useAppStore(selectAllExercises);
  const findExercise = useAppStore(selectFindExercise);
  const addExercise = useAppStore((s) => s.addExercise);
  const replaceExercise = useAppStore((s) => s.replaceExercise);
  const removeExercise = useAppStore((s) => s.removeExercise);
  const createCustomExercise = useAppStore((s) => s.createCustomExercise);
  const setWorkoutNotes = useAppStore((s) => s.setWorkoutNotes);
  const finishWorkout = useAppStore((s) => s.finishWorkout);
  const discardWorkout = useAppStore((s) => s.discardWorkout);
  const { error, run } = useAction();

  const [picker, setPicker] = useState<Picker | null>(null);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const selectable = useMemo(() => allExercises.filter((exercise) => !exercise.archived), [allExercises]);
  const inWorkoutIds = useMemo(() => workout.exercises.map((e) => e.exerciseId), [workout.exercises]);

  const requestReplace = useCallback((index: number) => setPicker({ mode: 'replace', index }), []);
  const requestRemove = useCallback((index: number) => setRemoveIndex(index), []);

  const deloadLoadFactor = plan?.id === workout.planId ? plan.cycle.deloadLoadFactor : undefined;
  const canFinish = canCompleteWorkout(workout.exercises);
  const notDone = workout.exercises.reduce((total, e) => total + e.sets.filter((s) => !s.done).length, 0);
  const deload = workout.phase === 'deload';
  const removing = removeIndex === null ? null : workout.exercises[removeIndex];
  const removingExercise = removing ? findExercise(removing.exerciseId) : undefined;

  const onSelect = (exercise: Exercise) => {
    const current = picker;
    setPicker(null);
    if (!current) return;
    void run(() =>
      current.mode === 'add' ? addExercise(exercise.id) : replaceExercise(current.index, exercise.id),
    );
  };

  const header = (
    <View style={styles.header}>
      <Text variant="title">{workout.name}</Text>
      {deload ? <Badge label={t('workout.deloadBadge')} /> : null}
      {workout.cycleNumber !== null && workout.cycleWeek !== null ? (
        <Text tone="secondary">
          {t(deload ? 'workout.cycleDeload' : 'workout.cycleLoad', {
            cycle: workout.cycleNumber,
            week: workout.cycleWeek,
          })}
        </Text>
      ) : null}
      <Text variant="caption" tone="secondary">
        {t('workout.started', {
          time: formatDate(new Date(workout.startedAt), { hour: 'numeric', minute: '2-digit' }),
        })}
      </Text>
      {error ? (
        <Text tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );

  const footer = (
    <View style={styles.footer}>
      <Button variant="secondary" label={t('workout.addExercise')} onPress={() => setPicker({ mode: 'add' })} />
      <NoteField label={t('workout.workoutNotes')} value={workout.notes} onSave={setWorkoutNotes} />
      {canFinish ? null : (
        <Text variant="caption" tone="secondary">
          {t('workout.finishHint')}
        </Text>
      )}
      <Button
        label={t('workout.finish')}
        hint={canFinish ? undefined : t('workout.finishHint')}
        disabled={!canFinish}
        onPress={() => (notDone > 0 ? setConfirmFinish(true) : void run(() => finishWorkout()))}
      />
      <Button variant="secondary" label={t('workout.discard')} onPress={() => setConfirmDiscard(true)} />
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: colors.background }]} testID="screen-workout">
      <FlatList
        data={workout.exercises}
        keyExtractor={(item, index) => `${index}-${item.exerciseId}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        renderItem={({ item, index }) => (
          <ExerciseCard
            index={index}
            exercise={item}
            suggestion={item.planExerciseId ? suggestions[item.planExerciseId] : undefined}
            deloadLoadFactor={deloadLoadFactor}
            onRequestReplace={requestReplace}
            onRequestRemove={requestRemove}
          />
        )}
      />

      <ExerciseSelectModal
        visible={picker !== null}
        title={t(picker?.mode === 'replace' ? 'workout.replaceExercise' : 'workout.addExercise')}
        exercises={selectable}
        excludeIds={picker?.mode === 'replace' ? inWorkoutIds : undefined}
        onSelect={onSelect}
        onClose={() => setPicker(null)}
        onCreateExercise={createCustomExercise}
      />
      <ConfirmDialog
        visible={removing !== null}
        title={t('workout.removeExerciseTitle')}
        message={t('workout.removeExerciseMessage', {
          name: removingExercise ? exerciseLabel(removingExercise) : '',
        })}
        confirmLabel={t('workout.removeExercise')}
        destructive
        testID="remove-dialog"
        onCancel={() => setRemoveIndex(null)}
        onConfirm={() => {
          const index = removeIndex;
          setRemoveIndex(null);
          if (index !== null) void run(() => removeExercise(index));
        }}
      />
      <ConfirmDialog
        visible={confirmFinish}
        title={t('workout.finishConfirmTitle')}
        message={t('workout.finishConfirmMessage', { count: notDone })}
        confirmLabel={t('workout.finish')}
        testID="finish-dialog"
        onCancel={() => setConfirmFinish(false)}
        onConfirm={() => {
          setConfirmFinish(false);
          void run(() => finishWorkout());
        }}
      />
      <ConfirmDialog
        visible={confirmDiscard}
        title={t('workout.discardTitle')}
        message={t('workout.discardMessage')}
        confirmLabel={t('workout.discard')}
        destructive
        testID="discard-dialog"
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          void run(() => discardWorkout());
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: { gap: spacing.xs },
  footer: { gap: spacing.md },
});
