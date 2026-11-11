import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing, layout } from '@/constants/theme';
import { WORKOUT_LIMITS, workoutSummary, type SetErrors, type Workout, type WorkoutExercise } from '@/domain/workout';
import { useI18n } from '@/i18n';
import { WorkoutValidationError, useAppStore } from '@/state';

import { ConfirmDialog, EmptyState } from '../shared';
import { Button, Card, Screen, Text, TextField } from '../ui';
import { ExerciseDetailBlock, type ExerciseEditing } from './exercise-detail-block';
import { WorkoutBadge } from './workout-badge';

export type HistoryDetailScreenProps = {
  workoutId: number;
  onBack: () => void;
  onOpenExercise: (exerciseId: string) => void;
  /** Called after the workout was deleted. */
  onDeleted: () => void;
};

/** Workout detail (SPEC §8): sets, notes, comparison with the previous session, edit and delete. */
export function HistoryDetailScreen({
  workoutId,
  onBack,
  onOpenExercise,
  onDeleted,
}: HistoryDetailScreenProps) {
  const { t } = useI18n();
  const workout = useAppStore((s) => s.workouts.find((w) => w.id === workoutId));

  if (!workout) {
    return (
      <Screen title={t('history.detailTitle')} testID="screen-history-detail">
        <EmptyState
          title={t('history.notFoundTitle')}
          message={t('history.notFoundMessage')}
          actionLabel={t('common.back')}
          onAction={onBack}
          testID="history-not-found"
        />
      </Screen>
    );
  }
  return (
    <LoadedDetail
      workout={workout}
      onBack={onBack}
      onOpenExercise={onOpenExercise}
      onDeleted={onDeleted}
    />
  );
}

type Draft = { exercises: WorkoutExercise[]; notes: string };

type DraftErrors = {
  /** Set errors keyed `exerciseIndex:setIndex`. */
  sets: Record<string, SetErrors>;
  /** Exercise indexes with a too long note; `-1` is the workout notes. */
  notes: number[];
};

const NO_ERRORS: DraftErrors = { sets: {}, notes: [] };

const copyExercises = (exercises: readonly WorkoutExercise[]): WorkoutExercise[] =>
  exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) }));

function LoadedDetail({
  workout,
  onBack,
  onOpenExercise,
  onDeleted,
}: Omit<HistoryDetailScreenProps, 'workoutId'> & { workout: Workout }) {
  const { t, formatDate, formatKg, formatTime } = useI18n();
  const planName = useAppStore((s) =>
    workout.planId === null ? null : (s.plans.find((p) => p.id === workout.planId)?.name ?? null),
  );
  const amendWorkout = useAppStore((s) => s.amendWorkout);
  const deleteWorkout = useAppStore((s) => s.deleteWorkout);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<DraftErrors>(NO_ERRORS);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const summary = workoutSummary(workout);
  const completedAt = new Date(workout.completedAt ?? workout.startedAt);
  const isFree = workout.planId === null && workout.planWorkoutId === null;
  const noteTooLong = t('history.noteTooLong', { max: WORKOUT_LIMITS.note.max });

  const startEditing = () => {
    setDraft({ exercises: copyExercises(workout.exercises), notes: workout.notes });
    setErrors(NO_ERRORS);
    setMessage(null);
  };
  const stopEditing = () => {
    setDraft(null);
    setErrors(NO_ERRORS);
    setMessage(null);
  };

  const changeExercise = (index: number, change: (exercise: WorkoutExercise) => WorkoutExercise) =>
    setDraft((current) =>
      current
        ? { ...current, exercises: current.exercises.map((e, i) => (i === index ? change(e) : e)) }
        : current,
    );
  const changeSet = (
    exerciseIndex: number,
    setIndex: number,
    change: (set: WorkoutExercise['sets'][number]) => WorkoutExercise['sets'][number],
  ) => {
    changeExercise(exerciseIndex, (e) => ({
      ...e,
      sets: e.sets.map((s, i) => (i === setIndex ? change(s) : s)),
    }));
    setErrors((current) => {
      const { [`${exerciseIndex}:${setIndex}`]: _cleared, ...sets } = current.sets;
      return { ...current, sets };
    });
  };

  const save = async () => {
    if (!draft || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      await amendWorkout(workout.id, { exercises: draft.exercises, notes: draft.notes });
      stopEditing();
    } catch (error) {
      if (error instanceof WorkoutValidationError) {
        const sets: Record<string, SetErrors> = {};
        for (const issue of error.sets) sets[`${issue.exerciseIndex}:${issue.setIndex}`] = issue.errors;
        setErrors({ sets, notes: error.notes.map((n) => n.exerciseIndex ?? -1) });
      } else {
        setMessage(t('history.saveFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setConfirmingDelete(false);
    try {
      await deleteWorkout(workout.id);
      onDeleted();
    } catch {
      setMessage(t('history.deleteFailed'));
    }
  };

  const editingFor = (exerciseIndex: number): ExerciseEditing | undefined => {
    const exercise = draft?.exercises[exerciseIndex];
    if (!draft || !exercise) return undefined;
    const setErrors_: Record<number, SetErrors> = {};
    exercise.sets.forEach((_, setIndex) => {
      const found = errors.sets[`${exerciseIndex}:${setIndex}`];
      if (found) setErrors_[setIndex] = found;
    });
    return {
      exercise,
      setErrors: setErrors_,
      noteError: errors.notes.includes(exerciseIndex) ? noteTooLong : undefined,
      onChangeSet: (setIndex, change) => changeSet(exerciseIndex, setIndex, (s) => ({ ...s, ...change })),
      onToggleDone: (setIndex) => changeSet(exerciseIndex, setIndex, (s) => ({ ...s, done: !s.done })),
      onToggleKind: (setIndex) =>
        changeSet(exerciseIndex, setIndex, (s) => ({
          ...s,
          kind: s.kind === 'warmup' ? 'working' : 'warmup',
        })),
      onRemoveSet: (setIndex) => {
        changeExercise(exerciseIndex, (e) => ({ ...e, sets: e.sets.filter((_, i) => i !== setIndex) }));
        setErrors((current) => ({ ...current, sets: {} }));
      },
      onAddSet: () =>
        changeExercise(exerciseIndex, (e) => ({
          ...e,
          sets: [
            ...e.sets,
            {
              kind: 'working',
              weightKg: e.sets[e.sets.length - 1]?.weightKg ?? null,
              reps: null,
              rir: null,
              done: true,
            },
          ],
        })),
      onChangeNote: (note) => {
        changeExercise(exerciseIndex, (e) => ({ ...e, note }));
        setErrors((current) => ({ ...current, notes: current.notes.filter((i) => i !== exerciseIndex) }));
      },
    };
  };

  const durationMinutes =
    summary.durationSeconds === null ? null : Math.floor(summary.durationSeconds / 60);

  return (
    <Screen title={workout.name} testID="screen-history-detail">
      <Button variant="secondary" label={t('common.back')} onPress={onBack} />

      <Card>
        <View style={styles.badges}>
          {workout.phase === 'deload' ? <WorkoutBadge label={t('history.deload')} /> : null}
        </View>
        <Text>
          {t('history.dateTime', {
            date: formatDate(completedAt),
            time: formatTime(completedAt),
          })}
        </Text>
        {durationMinutes !== null ? (
          <Text tone="secondary">
            {durationMinutes >= 60
              ? t('history.durationHours', {
                  hours: Math.floor(durationMinutes / 60),
                  minutes: durationMinutes % 60,
                })
              : t('history.durationMinutes', { minutes: durationMinutes })}
          </Text>
        ) : null}
        {isFree ? (
          <Text tone="secondary">{t('history.freeWorkout')}</Text>
        ) : planName ? (
          <Text tone="secondary">{t('history.planName', { name: planName })}</Text>
        ) : null}
        {workout.cycleNumber !== null && workout.cycleWeek !== null ? (
          <Text tone="secondary">
            {t('history.cycleWeek', { cycle: workout.cycleNumber, week: workout.cycleWeek })}
          </Text>
        ) : null}
        <View style={styles.totals}>
          <Text tabular>{t('history.workingSets', { count: summary.workingSets })}</Text>
          <Text tabular>
            {t('history.volume', { volume: formatKg(summary.volumeKg, { minimumFractionDigits: 0 }) })}
          </Text>
        </View>
        {draft ? (
          <TextField
            label={t('history.workoutNotesLabel')}
            value={draft.notes}
            onChangeText={(notes) => {
              setDraft({ ...draft, notes });
              setErrors((current) => ({ ...current, notes: current.notes.filter((i) => i !== -1) }));
            }}
            error={errors.notes.includes(-1) ? noteTooLong : undefined}
          />
        ) : workout.notes ? (
          <Text>{t('history.notes', { notes: workout.notes })}</Text>
        ) : null}
      </Card>

      {workout.exercises.map((exercise, index) => (
        <ExerciseDetailBlock
          key={index}
          workout={workout}
          exercise={exercise}
          editing={editingFor(index)}
          onOpenExercise={onOpenExercise}
        />
      ))}

      {message ? (
        <Text tone="danger" accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {draft ? (
          <>
            <Button label={t('common.save')} onPress={save} disabled={saving} />
            <Button variant="secondary" label={t('common.cancel')} onPress={stopEditing} />
          </>
        ) : (
          <>
            <Button label={t('common.edit')} onPress={startEditing} />
            <Button
              variant="secondary"
              label={t('common.delete')}
              onPress={() => setConfirmingDelete(true)}
            />
          </>
        )}
      </View>

      <ConfirmDialog
        visible={confirmingDelete}
        title={t('history.deleteTitle')}
        message={t('history.deleteMessage')}
        confirmLabel={t('history.deleteConfirm')}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', gap: spacing.sm },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    minHeight: layout.minTouchTarget,
  },
});
