import { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, spacing } from '@/constants/theme';
import { countedSets } from '@/domain/metrics';
import type { Suggestion } from '@/domain/progression';
import type { SetErrors, WorkoutExercise } from '@/domain/workout';
import { useI18n } from '@/i18n';
import {
  selectBarKg,
  selectExerciseNote,
  selectFindExercise,
  selectLastSession,
  useAppStore,
  WorkoutSetOrderError,
} from '@/state';

import { SetRow, SetRowHeader, useExerciseName } from '../shared';
import { useTheme } from '../theme-provider';
import { Button, Card, Text } from '../ui';
import { targetLine } from './exercise-target';
import { NoteField } from './note-field';
import { platesText } from './plates-text';
import { suggestionText } from './suggestion-text';
import { useAction } from './use-action';

const HOW_TO_URL = 'https://www.youtube.com/results?search_query=';
/** Limit of the persistent exercise note (SPEC-v3 §11). */
const EXERCISE_NOTE_MAX = 200;

export type ExerciseCardProps = {
  index: number;
  exercise: WorkoutExercise;
  suggestion: Suggestion | undefined;
  deloadLoadFactor: number | undefined;
  /** The plan's RIR ramp sets the target RIR: the target line says "this week". */
  rirThisWeek?: boolean;
  /** Rendered inside a superset card: a plain section instead of a card of its own. */
  grouped?: boolean;
  /** Grouped only: a divider above (every exercise of the block but the first). */
  divider?: boolean;
  openUrl: (url: string) => void;
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
    previous.rirThisWeek === next.rirThisWeek &&
    previous.grouped === next.grouped &&
    previous.divider === next.divider &&
    previous.openUrl === next.openUrl &&
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
  rirThisWeek = false,
  grouped = false,
  divider = false,
  openUrl,
  onRequestReplace,
  onRequestRemove,
}: ExerciseCardProps) {
  const { colors } = useTheme();
  const i18n = useI18n();
  const { t } = i18n;
  const exerciseLabel = useExerciseName();
  const found = useAppStore((s) => selectFindExercise(s)(exercise.exerciseId));
  const lastSession = useAppStore((s) => selectLastSession(s, exercise.exerciseId));
  const savedNote = useAppStore((s) => selectExerciseNote(s, exercise.exerciseId));
  const barKg = useAppStore((s) => selectBarKg(s, exercise.exerciseId));
  const platesKg = useAppStore((s) => s.settings?.platesKg);
  const updateSet = useAppStore((s) => s.updateSet);
  const toggleSetDone = useAppStore((s) => s.toggleSetDone);
  const setSetKind = useAppStore((s) => s.setSetKind);
  const addSet = useAppStore((s) => s.addSet);
  const removeSet = useAppStore((s) => s.removeSet);
  const addDropSet = useAppStore((s) => s.addDropSet);
  const addWarmupSets = useAppStore((s) => s.addWarmupSets);
  const setExerciseNote = useAppStore((s) => s.setExerciseNote);
  const setExerciseSettingsNote = useAppStore((s) => s.setExerciseSettingsNote);

  const { error, run } = useAction();
  const [errors, setErrors] = useState<Record<number, SetErrors>>({});
  const [rowMessages, setRowMessages] = useState<Record<number, string>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(exercise.note !== '');
  const [editingNote, setEditingNote] = useState(false);
  const [platesOpen, setPlatesOpen] = useState(false);
  const [warmupHint, setWarmupHint] = useState(false);

  const lastSets = useMemo(() => (lastSession ? countedSets(lastSession.sets) : []), [lastSession]);
  const name = found ? exerciseLabel(found) : exercise.exerciseId;
  const { target } = exercise;
  const barbell = found?.equipment === 'barbell';

  const plateWeights = useMemo(
    () => [
      ...new Set(
        exercise.sets.flatMap((set) =>
          set.kind === 'working' && set.weightKg !== null ? [set.weightKg] : [],
        ),
      ),
    ],
    [exercise.sets],
  );

  // Warm-up and working sets are numbered in order; a drop set keeps the number of its parent.
  const numbers = useMemo(() => {
    let count = 0;
    return exercise.sets.map((set) => {
      if (set.kind !== 'drop') count += 1;
      return count;
    });
  }, [exercise.sets]);

  const clearErrors = (setIndex: number) =>
    setErrors((previous) => {
      if (!(setIndex in previous)) return previous;
      const { [setIndex]: _removed, ...rest } = previous;
      return rest;
    });

  const clearRowMessage = (setIndex: number) =>
    setRowMessages((previous) => {
      if (!(setIndex in previous)) return previous;
      const { [setIndex]: _removed, ...rest } = previous;
      return rest;
    });

  /** Runs a set action: a drop-set order rejection shows on the row, any other one on the card. */
  const runOnRow = async (setIndex: number, job: () => Promise<unknown>) => {
    try {
      await job();
      clearRowMessage(setIndex);
    } catch (caught) {
      if (caught instanceof WorkoutSetOrderError) {
        setRowMessages((previous) => ({
          ...previous,
          [setIndex]: t('workout.errors.dropOrder'),
        }));
      } else {
        void run(() => Promise.reject(caught));
      }
    }
  };

  const Wrapper = grouped ? View : Card;
  const wrapperProps = grouped
    ? {
        style: [
          styles.grouped,
          divider && {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
          },
        ],
      }
    : {};

  return (
    <Wrapper testID={`exercise-card-${index}`} {...wrapperProps}>
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
            label={t('workout.howTo')}
            onPress={() => {
              setMenuOpen(false);
              openUrl(`${HOW_TO_URL}${encodeURIComponent(name)}`);
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
          {targetLine(t, target, suggestion?.sets ?? target.sets, rirThisWeek)}
        </Text>
      ) : null}
      {suggestion && target ? (
        <Text variant="caption" tone="secondary" testID={`suggestion-${index}`}>
          {suggestionText(suggestion, target, i18n, { deloadLoadFactor })}
        </Text>
      ) : null}

      {editingNote ? (
        <View style={styles.noteEditor}>
          <NoteField
            label={t('tools.exerciseNote')}
            value={savedNote}
            maxChars={EXERCISE_NOTE_MAX}
            onSave={(text) => setExerciseSettingsNote(exercise.exerciseId, text)}
          />
          <Button variant="secondary" label={t('workout.done')} onPress={() => setEditingNote(false)} />
        </View>
      ) : (
        <>
          {savedNote !== '' ? (
            <Text testID={`exercise-note-${index}`} tone="secondary">
              {savedNote}
            </Text>
          ) : null}
          <Button variant="secondary" label={t('tools.editNote')} onPress={() => setEditingNote(true)} />
        </>
      )}

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
        const position = numbers[setIndex] - 1;
        const isDrop = set.kind === 'drop';
        const last = isDrop ? undefined : lastSets[position];
        return (
          <View key={setIndex} style={styles.setBlock}>
            <SetRow
              testID={`set-row-${index}-${setIndex}`}
              index={position}
              set={set}
              placeholderReps={isDrop ? null : (suggestion?.targetReps[position] ?? null)}
              lastTime={last ? { weightKg: last.weightKg, reps: last.reps } : null}
              errors={errors[setIndex]}
              onChange={(change) => {
                clearErrors(setIndex);
                clearRowMessage(setIndex);
                void run(() => updateSet(index, setIndex, change));
              }}
              onToggleDone={() =>
                void runOnRow(setIndex, async () => {
                  const result = await toggleSetDone(index, setIndex);
                  setErrors((previous) => ({
                    ...previous,
                    [setIndex]: result,
                  }));
                })
              }
              onToggleKind={() =>
                void run(() => setSetKind(index, setIndex, set.kind === 'working' ? 'warmup' : 'working'))
              }
              onRemove={() => {
                setErrors({});
                setRowMessages({});
                void run(() => removeSet(index, setIndex));
              }}
              onAddDrop={() => void runOnRow(setIndex, () => addDropSet(index, setIndex))}
            />
            {rowMessages[setIndex] ? (
              <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
                {rowMessages[setIndex]}
              </Text>
            ) : null}
          </View>
        );
      })}

      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button
          variant="secondary"
          label={t('workout.addSet')}
          onPress={() => void run(() => addSet(index))}
        />
        <Button
          variant="secondary"
          label={t('tools.addWarmup')}
          onPress={() =>
            void run(async () => {
              setWarmupHint(!(await addWarmupSets(index)));
            })
          }
        />
        {barbell ? (
          <Button
            variant="secondary"
            label={t('tools.plates')}
            hint={t('tools.platesTitle')}
            onPress={() => setPlatesOpen((open) => !open)}
          />
        ) : null}
      </View>
      {warmupHint ? (
        <Text
          variant="caption"
          tone="secondary"
          accessibilityLiveRegion="polite"
          testID={`warmup-hint-${index}`}>
          {t('tools.warmupNeedsWeight')}
        </Text>
      ) : null}
      {barbell && platesOpen ? (
        <View testID={`plates-${index}`} style={styles.plates}>
          {plateWeights.length === 0 ? (
            <Text variant="caption" tone="secondary">
              {t('tools.platesEmpty')}
            </Text>
          ) : (
            plateWeights.map((weight) => (
              <Text key={weight} tabular>
                {platesText(i18n, weight, barKg, platesKg ?? [])}
              </Text>
            ))
          )}
        </View>
      ) : null}
    </Wrapper>
  );
}, sameProps);

const styles = StyleSheet.create({
  grouped: { gap: spacing.md, paddingTop: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1 },
  menuButton: {
    minWidth: layout.minTouchTarget,
    minHeight: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  noteEditor: { gap: spacing.sm },
  setBlock: { gap: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  plates: { gap: spacing.xs },
});
