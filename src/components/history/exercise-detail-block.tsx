import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, spacing } from '@/constants/theme';
import { countedSets, volume } from '@/domain/metrics';
import { bestE1rm, newRecords, topWeight } from '@/domain/stats';
import type { SetErrors, Workout, WorkoutExercise } from '@/domain/workout';
import { useI18n } from '@/i18n';
import { selectExerciseSessions, selectFindExercise, useAppStore } from '@/state';

import { SetRow, SetRowHeader, useExerciseName, type SetRowChange } from '../shared';
import { Button, Card, Text, TextField } from '../ui';
import { WorkoutBadge } from './workout-badge';

export type ExerciseEditing = {
  /** The editable copy of the exercise. */
  exercise: WorkoutExercise;
  /** Error codes by set index. */
  setErrors: Record<number, SetErrors>;
  /** Localized message of the exercise note, when invalid. */
  noteError?: string;
  onChangeSet: (setIndex: number, change: SetRowChange) => void;
  onToggleDone: (setIndex: number) => void;
  onToggleKind: (setIndex: number) => void;
  onRemoveSet: (setIndex: number) => void;
  onAddSet: () => void;
  onChangeNote: (note: string) => void;
};

export type ExerciseDetailBlockProps = {
  workout: Workout;
  /** The stored exercise (what the read-only view and the comparison use). */
  exercise: WorkoutExercise;
  editing?: ExerciseEditing;
  onOpenExercise: (exerciseId: string) => void;
};

/** `+2.5 kg`, `−120 kg` (true minus sign), `0 kg`. */
function useSignedKg() {
  const { formatKg } = useI18n();
  return (delta: number) => {
    const rounded = Math.round(delta * 1000) / 1000;
    const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
    return `${sign}${formatKg(Math.abs(rounded), { minimumFractionDigits: 0 })}`;
  };
}

/** One exercise of a completed workout: its sets (or editable rows), stats and comparison. */
export function ExerciseDetailBlock({
  workout,
  exercise,
  editing,
  onOpenExercise,
}: ExerciseDetailBlockProps) {
  const { t, formatKg } = useI18n();
  const nameOf = useExerciseName();
  const signedKg = useSignedKg();
  const find = useAppStore(selectFindExercise);
  const sessions = useAppStore((s) => selectExerciseSessions(s, exercise.exerciseId));

  const info = find(exercise.exerciseId);
  const name = info ? nameOf(info) : exercise.exerciseId;
  const kg = (value: number) => formatKg(value, { minimumFractionDigits: 0 });

  const stats = useMemo(() => {
    const position = sessions.findIndex((s) => s.workoutId === workout.id);
    const before = position < 0 ? sessions : sessions.slice(position + 1);
    const previous = before[0] ?? null;
    const records = newRecords({ ...workout, exercises: [exercise] }, () => before);
    const top = topWeight(exercise.sets);
    const previousTop = previous ? topWeight(previous.sets) : null;
    const vol = volume(exercise.sets);
    const previousVol = previous ? volume(previous.sets) : null;
    return {
      previous,
      records,
      volume: vol,
      e1rm: bestE1rm(exercise.sets),
      topDelta:
        top !== null && previousTop !== null && (top > 0 || previousTop > 0) ? top - previousTop : null,
      volumeDelta:
        previousVol !== null && (vol > 0 || previousVol > 0) ? vol - previousVol : null,
    };
  }, [sessions, workout, exercise]);

  const hasWeightRecord = stats.records.some((r) => r.kind === 'weight');
  const hasE1rmRecord = stats.records.some((r) => r.kind === 'e1rm');
  const hasWork = countedSets(exercise.sets).length > 0;

  return (
    <Card testID={`history-exercise-${exercise.exerciseId}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('history.openExercise', { name })}
        onPress={() => onOpenExercise(exercise.exerciseId)}
        style={styles.nameButton}>
        <Text variant="heading">{name}</Text>
      </Pressable>

      {editing ? (
        <View style={styles.editing}>
          <SetRowHeader />
          {editing.exercise.sets.map((set, setIndex) => (
            <SetRow
              key={setIndex}
              index={setIndex}
              set={set}
              errors={editing.setErrors[setIndex]}
              onChange={(change) => editing.onChangeSet(setIndex, change)}
              onToggleDone={() => editing.onToggleDone(setIndex)}
              onToggleKind={() => editing.onToggleKind(setIndex)}
              onRemove={() => editing.onRemoveSet(setIndex)}
            />
          ))}
          <Button
            variant="secondary"
            label={t('common.add')}
            accessibilityLabel={t('history.addSet', { name })}
            onPress={editing.onAddSet}
          />
          <TextField
            label={t('history.exerciseNoteLabel', { name })}
            value={editing.exercise.note}
            onChangeText={editing.onChangeNote}
            error={editing.noteError}
          />
        </View>
      ) : (
        <View style={styles.sets}>
          {exercise.sets.map((set, setIndex) => (
            <View key={setIndex} style={styles.setLine}>
              <Text tabular>
                {t('history.setLine', { weight: kg(set.weightKg ?? 0), reps: set.reps ?? 0 })}
              </Text>
              {set.rir !== null ? (
                <Text tone="secondary" tabular>
                  {t('history.rir', { rir: set.rir })}
                </Text>
              ) : null}
              {set.kind === 'warmup' ? (
                <Text tone="accent" variant="label">
                  {t('common.warmupSet')}
                </Text>
              ) : null}
            </View>
          ))}
          {exercise.note ? (
            <Text tone="secondary">{t('history.exerciseNote', { note: exercise.note })}</Text>
          ) : null}
        </View>
      )}

      {hasWork ? (
        <View style={styles.stats}>
          <Text tabular>{t('history.exerciseVolume', { volume: kg(stats.volume) })}</Text>
          {stats.e1rm !== null ? (
            <Text tabular>{t('history.e1rm', { value: kg(stats.e1rm) })}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.stats}>
        {stats.previous === null ? (
          <Text tone="secondary">{t('history.firstSession')}</Text>
        ) : (
          <>
            {stats.topDelta !== null ? (
              <Text tone="secondary" tabular>
                {t('history.topWeightDelta', { delta: signedKg(stats.topDelta) })}
              </Text>
            ) : null}
            {stats.volumeDelta !== null ? (
              <Text tone="secondary" tabular>
                {t('history.volumeDelta', { delta: signedKg(stats.volumeDelta) })}
              </Text>
            ) : null}
          </>
        )}
        {hasWeightRecord || hasE1rmRecord ? (
          <View style={styles.records}>
            {hasWeightRecord ? <WorkoutBadge accent label={t('history.recordWeight')} /> : null}
            {hasE1rmRecord ? <WorkoutBadge accent label={t('history.recordE1rm')} /> : null}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  nameButton: { minHeight: layout.minTouchTarget, justifyContent: 'center' },
  editing: { gap: spacing.md },
  sets: { gap: spacing.xs },
  setLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  stats: { gap: spacing.xs },
  records: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
