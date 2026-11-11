import { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, spacing } from '@/constants/theme';
import { countedSets } from '@/domain/metrics';
import type { Suggestion } from '@/domain/progression';
import type { SetErrors, WorkoutExercise } from '@/domain/workout';
import { useI18n } from '@/i18n';
import { selectFindExercise, selectLastSession, useAppStore } from '@/state';

import { SetRow, SetRowHeader, useExerciseName } from '../shared';
import { Button, Card, Text } from '../ui';
import { targetLine } from './exercise-target';
import { NoteField } from './note-field';
import { suggestionText } from './suggestion-text';
import { useAction } from './use-action';

export type ExerciseCardProps = {
  index: number;
  exercise: WorkoutExercise;
  suggestion: Suggestion | undefined;
  deloadLoadFactor: number | undefined;
  onRequestReplace: (index: number) => void;
  onRequestRemove: (index: number) => void;
};

/**
 * The store recomputes every suggestion object on each edit; a card only needs to re-render
 * when its own exercise or the numbers of its suggestion change.
 */
function sameProps(previous: ExerciseCardProps, next: ExerciseCardProps): boolean {
  return (
    previous.index === next.index &&
    previous.exercise === next.exercise &&
    previous.deloadLoadFactor === next.deloadLoadFactor &&
    previous.onRequestReplace === next.onRequestReplace &&
    previous.onRequestRemove === next.onRequestRemove &&
    (previous.suggestion === next.suggestion ||
      JSON.stringify(previous.suggestion) === JSON.stringify(next.suggestion))
  );
}

/** One exercise of the workout in progress: target, suggestion, notes and its set rows (SPEC §7.3). */
export const ExerciseCard = memo(function ExerciseCard({
  index,
  exercise,
  suggestion,
  deloadLoadFactor,
  onRequestReplace,
  onRequestRemove,
}: ExerciseCardProps) {
  const i18n = useI18n();
  const { t } = i18n;
  const exerciseLabel = useExerciseName();
  const found = useAppStore((s) => selectFindExercise(s)(exercise.exerciseId));
  const lastSession = useAppStore((s) => selectLastSession(s, exercise.exerciseId));
  const updateSet = useAppStore((s) => s.updateSet);
  const toggleSetDone = useAppStore((s) => s.toggleSetDone);
  const setSetKind = useAppStore((s) => s.setSetKind);
  const addSet = useAppStore((s) => s.addSet);
  const removeSet = useAppStore((s) => s.removeSet);
  const setExerciseNote = useAppStore((s) => s.setExerciseNote);

  const { error, run } = useAction();
  const [errors, setErrors] = useState<Record<number, SetErrors>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(exercise.note !== '');

  const lastSets = useMemo(() => (lastSession ? countedSets(lastSession.sets) : []), [lastSession]);
  const name = found ? exerciseLabel(found) : exercise.exerciseId;
  const { target } = exercise;

  const clearErrors = (setIndex: number) =>
    setErrors((previous) => {
      if (!(setIndex in previous)) return previous;
      const { [setIndex]: _removed, ...rest } = previous;
      return rest;
    });

  return (
    <Card testID={`exercise-card-${index}`}>
      <View style={styles.titleRow}>
        <Text variant="heading" style={styles.title}>
          {name}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('workout.exerciseOptions')}
          accessibilityState={{ expanded: menuOpen }}
          onPress={() => setMenuOpen((open) => !open)}
          style={styles.menuButton}>
          <Text variant="heading">⋯</Text>
        </Pressable>
      </View>

      {menuOpen ? (
        <View style={styles.menu}>
          <Button
            variant="secondary"
            label={t('workout.replaceExercise')}
            onPress={() => {
              setMenuOpen(false);
              onRequestReplace(index);
            }}
          />
          <Button
            variant="secondary"
            label={t('workout.removeExercise')}
            onPress={() => {
              setMenuOpen(false);
              onRequestRemove(index);
            }}
          />
        </View>
      ) : null}

      {target ? (
        <Text variant="caption" tone="secondary" tabular>
          {targetLine(t, target, suggestion?.sets ?? target.sets)}
        </Text>
      ) : null}
      {suggestion && target ? (
        <Text variant="caption" tone="secondary" testID={`suggestion-${index}`}>
          {suggestionText(suggestion, target, i18n, { deloadLoadFactor })}
        </Text>
      ) : null}

      {noteOpen ? (
        <NoteField
          label={t('workout.exerciseNote')}
          value={exercise.note}
          onSave={(text) => setExerciseNote(index, text)}
        />
      ) : (
        <Button variant="secondary" label={t('workout.note')} onPress={() => setNoteOpen(true)} />
      )}

      <SetRowHeader />
      {exercise.sets.map((set, setIndex) => {
        const last = lastSets[setIndex];
        return (
          <SetRow
            key={setIndex}
            testID={`set-row-${index}-${setIndex}`}
            index={setIndex}
            set={set}
            placeholderReps={suggestion?.targetReps[setIndex] ?? null}
            lastTime={last ? { weightKg: last.weightKg, reps: last.reps } : null}
            errors={errors[setIndex]}
            onChange={(change) => {
              clearErrors(setIndex);
              void run(() => updateSet(index, setIndex, change));
            }}
            onToggleDone={() =>
              void run(async () => {
                const result = await toggleSetDone(index, setIndex);
                setErrors((previous) => ({ ...previous, [setIndex]: result }));
              })
            }
            onToggleKind={() =>
              void run(() => setSetKind(index, setIndex, set.kind === 'working' ? 'warmup' : 'working'))
            }
            onRemove={() => {
              setErrors({});
              void run(() => removeSet(index, setIndex));
            }}
          />
        );
      })}

      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Button variant="secondary" label={t('workout.addSet')} onPress={() => void run(() => addSet(index))} />
    </Card>
  );
}, sameProps);

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1 },
  menuButton: {
    minWidth: layout.minTouchTarget,
    minHeight: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
