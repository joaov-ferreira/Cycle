import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, spacing } from '@/constants/theme';
import type { Exercise } from '@/domain/exercise';
import type { Suggestion } from '@/domain/progression';
import { canCompleteWorkout, type Workout } from '@/domain/workout';
import { useI18n, type MessageKey } from '@/i18n';
import {
  selectActivePlan,
  selectAllExercises,
  selectFindExercise,
  selectSimilarExercises,
  selectWorkoutLayout,
  selectWorkoutSuggestions,
  useAppStore,
} from '@/state';

import { ConfirmDialog, ExerciseSelectModal, useExerciseName } from '../shared';
import { useTheme } from '../theme-provider';
import { Button, Card, Text } from '../ui';
import { Badge } from './badge';
import { ExerciseCard } from './exercise-card';
import { NoteField } from './note-field';
import { RestTimerBar } from './rest-timer-bar';
import { useAction } from './use-action';

const NO_EXERCISES: Exercise[] = [];

export type WorkoutLoggerProps = {
  workout: Workout;
  now: () => number;
  vibrate: (pattern: number[]) => void;
  openUrl: (url: string) => void;
};

/** Heading of a superset by its number of exercises (SPEC-v3 §4.1). */
const SUPERSET_TITLE: Record<number, MessageKey> = {
  2: 'workout.superset',
  3: 'workout.supersetThree',
  4: 'workout.supersetFour',
};

type Picker = { mode: 'add' } | { mode: 'replace'; index: number };

/** The workout in progress (SPEC §7.3): header, one card per exercise, notes, finish and discard. */
export function WorkoutLogger({ workout, now, vibrate, openUrl }: WorkoutLoggerProps) {
  const { colors } = useTheme();
  const { t, formatTime } = useI18n();
  const exerciseLabel = useExerciseName();
  const suggestions: Record<string, Suggestion> = useAppStore(selectWorkoutSuggestions);
  const plan = useAppStore(selectActivePlan);
  const layoutBlocks = useAppStore(selectWorkoutLayout);
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
  const replaceId = picker?.mode === 'replace' ? workout.exercises[picker.index]?.exerciseId : undefined;
  const similar = useAppStore((s) => (replaceId ? selectSimilarExercises(s, replaceId) : NO_EXERCISES));
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const selectable = useMemo(() => allExercises.filter((exercise) => !exercise.archived), [allExercises]);
  const inWorkoutIds = useMemo(() => workout.exercises.map((e) => e.exerciseId), [workout.exercises]);

  const requestReplace = useCallback((index: number) => setPicker({ mode: 'replace', index }), []);
  const requestRemove = useCallback((index: number) => setRemoveIndex(index), []);

  const rirThisWeek = plan?.id === workout.planId && !!plan?.cycle.rirRamp;
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
          time: formatTime(new Date(workout.startedAt)),
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
      <Button
        variant="secondary"
        label={t('workout.addExercise')}
        onPress={() => setPicker({ mode: 'add' })}
      />
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
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.root, { backgroundColor: colors.background }]}
      testID="screen-workout">
      <FlatList
        data={layoutBlocks}
        keyExtractor={(block) => `block-${block.indices[0]}`}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        renderItem={({ item: block }) => {
          const cards = block.indices.map((index, position) => {
            const item = workout.exercises[index];
            return (
              <ExerciseCard
                key={`${index}-${item.exerciseId}`}
                index={index}
                exercise={item}
                suggestion={item.planExerciseId ? suggestions[item.planExerciseId] : undefined}
                deloadLoadFactor={deloadLoadFactor}
                rirThisWeek={rirThisWeek}
                grouped={block.label !== null}
                divider={position > 0}
                openUrl={openUrl}
                onRequestReplace={requestReplace}
                onRequestRemove={requestRemove}
              />
            );
          });
          if (block.label === null) return cards[0];
          return (
            <Card testID={`superset-${block.indices[0]}`}>
              <Text variant="heading">
                {t(SUPERSET_TITLE[block.indices.length] ?? 'workout.supersetFour')}
              </Text>
              <Text variant="caption" tone="secondary">
                {t('workout.supersetHint')}
              </Text>
              {cards}
            </Card>
          );
        }}
      />
      <RestTimerBar now={now} vibrate={vibrate} />

      <ExerciseSelectModal
        visible={picker !== null}
        title={t(picker?.mode === 'replace' ? 'workout.replaceExercise' : 'workout.addExercise')}
        exercises={selectable}
        excludeIds={picker?.mode === 'replace' ? inWorkoutIds : undefined}
        suggested={picker?.mode === 'replace' ? similar : undefined}
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
  list: { flex: 1 },
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
