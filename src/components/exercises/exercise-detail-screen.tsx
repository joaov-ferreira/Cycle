import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, radius, spacing } from '@/constants/theme';
import {
  DEFAULT_SETTINGS,
  EXERCISE_NOTE_MAX_LENGTH,
  ExerciseInUseError,
} from '@/data/repositories';
import {
  DEFAULT_INCREMENT_KG,
  INCREMENT_OVERRIDE_LIMITS,
  type CustomExerciseInput,
} from '@/domain/exercise';
import type { CustomExerciseErrors } from '@/domain/exercise-match';
import { countedSets } from '@/domain/metrics';
import { BAR_LIMITS } from '@/domain/plates';
import type { ExerciseSession } from '@/domain/workout';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';
import { CustomExerciseValidationError, NoteValidationError } from '@/state/errors';
import {
  selectBarKg,
  selectExerciseById,
  selectExerciseNote,
  selectExerciseSessions,
  selectIncrement,
  selectPersonalRecords,
} from '@/state/selectors';
import { selectSimilarExercises } from '@/state/selectors-v3';

import {
  ConfirmDialog,
  CustomExerciseForm,
  EmptyState,
  Stepper,
  equipmentLabelKey,
  exerciseName,
  mechanicsLabelKey,
  muscleLabelKey,
} from '../shared';
import { useTheme } from '../theme-provider';
import { Button, Card, Screen, Text } from '../ui';

const RECENT_SESSIONS = 5;

export type ExerciseDetailScreenProps = {
  exerciseId: string;
  onBack: () => void;
  onOpenProgress: (exerciseId: string) => void;
  onOpenWorkout: (workoutId: number) => void;
  /** Opens another exercise's detail (similar exercises). */
  onOpenExercise: (exerciseId: string) => void;
  /** Opens a URL; defaults to the system browser. */
  openUrl?: (url: string) => void;
};

type Message = 'inUse' | 'saveFailed';

/** Video search of an exercise name, the "How to do it" link (SPEC-v3 §11). */
export function videoSearchUrl(name: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(name)}`;
}

/** Opens a URL in the browser; a failure to open is ignored (nothing else depends on it). */
function openExternalUrl(url: string): void {
  void Linking.openURL(url).catch(() => undefined);
}

/** Counted sets grouped by weight, in order of first appearance: `[[40, [12, 12, 11]]]`. */
function groupByWeight(session: ExerciseSession): [number, number[]][] {
  const groups = new Map<number, number[]>();
  for (const set of countedSets(session.sets)) {
    const reps = groups.get(set.weightKg);
    if (reps) reps.push(set.reps);
    else groups.set(set.weightKg, [set.reps]);
  }
  return [...groups.entries()];
}

/** Exercise detail (SPEC §2.4): classification, load increment, records, history, custom actions. */
export function ExerciseDetailScreen({
  exerciseId,
  onBack,
  onOpenProgress,
  onOpenWorkout,
  onOpenExercise,
  openUrl = openExternalUrl,
}: ExerciseDetailScreenProps) {
  const { colors } = useTheme();
  const { t, locale, formatKg, formatDate } = useI18n();

  const exercise = useAppStore((s) => selectExerciseById(s, exerciseId));
  const note = useAppStore((s) => selectExerciseNote(s, exerciseId));
  const barKg = useAppStore((s) => selectBarKg(s, exerciseId));
  const hasOwnBar = useAppStore((s) => s.exerciseSettings[exerciseId]?.barKg !== undefined);
  const defaultBarKg = useAppStore((s) => s.settings?.barKg ?? DEFAULT_SETTINGS.barKg);
  const similar = useAppStore((s) => selectSimilarExercises(s, exerciseId));
  const setExerciseSettingsNote = useAppStore((s) => s.setExerciseSettingsNote);
  const setExerciseBar = useAppStore((s) => s.setExerciseBar);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [noteMessage, setNoteMessage] = useState<string | null>(null);
  const increment = useAppStore((s) => selectIncrement(s, exerciseId));
  const hasOverride = useAppStore((s) => s.incrementOverrides[exerciseId] !== undefined);
  const sessions = useAppStore((s) => selectExerciseSessions(s, exerciseId));
  const records = useAppStore((s) => selectPersonalRecords(s, exerciseId));
  const setIncrementOverride = useAppStore((s) => s.setIncrementOverride);
  const updateCustomExercise = useAppStore((s) => s.updateCustomExercise);
  const setExerciseArchived = useAppStore((s) => s.setExerciseArchived);
  const deleteCustomExercise = useAppStore((s) => s.deleteCustomExercise);

  const [editing, setEditing] = useState(false);
  const [formErrors, setFormErrors] = useState<CustomExerciseErrors | undefined>();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);

  const recent = useMemo(() => sessions.slice(0, RECENT_SESSIONS), [sessions]);

  const kg = (value: number) => formatKg(value, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  /** Runs a store action, mapping a rejection to a localized message instead of crashing. */
  const run = async (action: () => Promise<unknown>): Promise<boolean> => {
    setMessage(null);
    try {
      await action();
      return true;
    } catch (error) {
      setMessage(error instanceof ExerciseInUseError ? 'inUse' : 'saveFailed');
      return false;
    }
  };

  if (!exercise) {
    return (
      <Screen title={t('exercises.detailTitle')} testID="screen-exercise-detail">
        <EmptyState
          title={t('exercises.notFoundTitle')}
          message={t('exercises.notFoundMessage')}
          actionLabel={t('common.back')}
          onAction={onBack}
        />
      </Screen>
    );
  }

  const name = exerciseName(exercise, locale);

  if (editing && exercise.custom) {
    const submit = async (input: CustomExerciseInput) => {
      setBusy(true);
      setMessage(null);
      try {
        await updateCustomExercise(exercise.id, input);
        setFormErrors(undefined);
        setEditing(false);
      } catch (error) {
        if (error instanceof CustomExerciseValidationError) {
          setFormErrors(error.errors);
        } else {
          setFormErrors(undefined);
          setMessage('saveFailed');
        }
      } finally {
        setBusy(false);
      }
    };
    return (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[styles.root, { backgroundColor: colors.background }]}
        testID="screen-exercise-detail">
        <View style={styles.editTop}>
          <Text variant="title">{t('exercises.editTitle')}</Text>
          {message ? (
            <Text tone="danger" accessibilityRole="alert">
              {t(`exercises.${message}`)}
            </Text>
          ) : null}
        </View>
        <CustomExerciseForm
          initial={{
            name: exercise.name.en,
            primaryMuscle: exercise.primaryMuscle,
            equipment: exercise.equipment,
            mechanics: exercise.mechanics,
            secondaryMuscles: exercise.secondaryMuscles,
          }}
          errors={formErrors}
          submitLabel={t('common.save')}
          onSubmit={submit}
          onCancel={() => {
            setEditing(false);
            setFormErrors(undefined);
            setMessage(null);
          }}
          busy={busy}
        />
      </SafeAreaView>
    );
  }

  const otherName = exercise.custom ? null : exerciseName(exercise, locale === 'en' ? 'pt-BR' : 'en');
  const secondaryMuscles =
    exercise.secondaryMuscles.length > 0
      ? exercise.secondaryMuscles.map((muscle) => t(muscleLabelKey(muscle))).join(', ')
      : t('common.none');
  const defaultIncrement = DEFAULT_INCREMENT_KG[exercise.equipment];
  const weightRecord = records.weight && records.weight.valueKg > 0 ? records.weight : null;

  return (
    <Screen testID="screen-exercise-detail">
      <Button variant="secondary" label={t('common.back')} onPress={onBack} />

      <View style={styles.titleBlock}>
        <Text variant="title">{name}</Text>
        {otherName && otherName !== name ? <Text tone="secondary">{otherName}</Text> : null}
        <View style={styles.badges}>
          {exercise.custom ? (
            <Text variant="caption" tone="accent">
              {t('common.custom')}
            </Text>
          ) : null}
          {exercise.archived ? (
            <Text variant="caption" tone="accent">
              {t('exercises.archivedBadge')}
            </Text>
          ) : null}
        </View>
      </View>

      {message ? (
        <Text tone="danger" accessibilityRole="alert">
          {t(`exercises.${message}`)}
        </Text>
      ) : null}

      <Card>
        <Fact label={t('exercises.primaryMuscle')} value={t(muscleLabelKey(exercise.primaryMuscle))} />
        <Fact label={t('exercises.secondaryMuscles')} value={secondaryMuscles} />
        <Fact label={t('exercises.equipment')} value={t(equipmentLabelKey(exercise.equipment))} />
        <Fact label={t('exercises.mechanics')} value={t(mechanicsLabelKey(exercise.mechanics))} />
      </Card>

      <Card>
        <Text variant="heading">{t('exercises.incrementTitle')}</Text>
        <Stepper
          value={increment}
          min={INCREMENT_OVERRIDE_LIMITS.min}
          max={INCREMENT_OVERRIDE_LIMITS.max}
          step={INCREMENT_OVERRIDE_LIMITS.step}
          label={t('exercises.incrementLabel')}
          format={kg}
          onChange={(value) => void run(() => setIncrementOverride(exercise.id, value))}
        />
        <Text variant="caption" tone="secondary">
          {t('exercises.incrementHint')}
        </Text>
        {hasOverride ? (
          <Button
            variant="secondary"
            label={t('exercises.resetIncrement', { value: kg(defaultIncrement) })}
            onPress={() => void run(() => setIncrementOverride(exercise.id, null))}
          />
        ) : null}
      </Card>

      <Card testID="exercise-note">
        <Text variant="heading">{t('exercises.noteTitle')}</Text>
        <Text variant="caption" tone="secondary">
          {t('exercises.noteHint')}
        </Text>
        {noteDraft === null ? (
          <>
            <Text>{note === '' ? t('exercises.noNote') : note}</Text>
            <Button
              variant="secondary"
              label={t('exercises.editNote')}
              onPress={() => {
                setNoteMessage(null);
                setNoteDraft(note);
              }}
            />
          </>
        ) : (
          <>
            <TextInput
              accessibilityLabel={t('exercises.noteLabel')}
              multiline
              value={noteDraft}
              onChangeText={setNoteDraft}
              style={[
                styles.noteInput,
                { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            />
            {noteMessage ? (
              <Text tone="danger" accessibilityRole="alert">
                {noteMessage}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Button
                label={t('common.save')}
                onPress={async () => {
                  const text = noteDraft.trim();
                  setNoteMessage(null);
                  try {
                    await setExerciseSettingsNote(exercise.id, text === '' ? null : text);
                    setNoteDraft(null);
                  } catch (error) {
                    setNoteMessage(
                      error instanceof NoteValidationError
                        ? t('exercises.noteTooLong', { max: EXERCISE_NOTE_MAX_LENGTH })
                        : t('exercises.saveFailed'),
                    );
                  }
                }}
              />
              <Button
                variant="secondary"
                label={t('common.cancel')}
                onPress={() => {
                  setNoteDraft(null);
                  setNoteMessage(null);
                }}
              />
            </View>
          </>
        )}
      </Card>

      {exercise.equipment === 'barbell' ? (
        <Card testID="exercise-bar">
          <Text variant="heading">{t('exercises.barTitle')}</Text>
          <Stepper
            value={barKg}
            min={BAR_LIMITS.min}
            max={BAR_LIMITS.max}
            step={BAR_LIMITS.step}
            label={t('exercises.barLabel')}
            format={kg}
            onChange={(value) => void run(() => setExerciseBar(exercise.id, value))}
          />
          {hasOwnBar ? (
            <Button
              variant="secondary"
              label={t('exercises.resetBar', { value: kg(defaultBarKg) })}
              onPress={() => void run(() => setExerciseBar(exercise.id, null))}
            />
          ) : null}
        </Card>
      ) : null}

      <Card testID="exercise-records">
        <Text variant="heading">{t('exercises.recordsTitle')}</Text>
        {!weightRecord && !records.e1rm ? (
          <Text tone="secondary">{t('exercises.noRecords')}</Text>
        ) : null}
        {weightRecord ? (
          <View style={styles.record}>
            <Text variant="caption" tone="secondary">
              {t('exercises.weightRecord')}
            </Text>
            <Text variant="label" tabular>
              {t('exercises.weightRecordValue', {
                weight: kg(weightRecord.valueKg),
                reps: weightRecord.reps,
              })}
            </Text>
            <Text variant="caption" tone="secondary">
              {formatDate(new Date(weightRecord.at))}
            </Text>
          </View>
        ) : null}
        {records.e1rm ? (
          <View style={styles.record}>
            <Text variant="caption" tone="secondary">
              {t('exercises.e1rmRecord')}
            </Text>
            <Text variant="label" tabular>
              {t('exercises.e1rmRecordValue', {
                value: formatKg(records.e1rm.valueKg, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
              })}
            </Text>
            <Text variant="caption" tone="secondary">
              {formatDate(new Date(records.e1rm.at))}
            </Text>
          </View>
        ) : null}
      </Card>

      <View style={styles.history}>
        <Text variant="heading">{t('exercises.historyTitle')}</Text>
        {recent.length === 0 ? <Text tone="secondary">{t('exercises.noHistory')}</Text> : null}
        {recent.map((session) => {
          const date = formatDate(new Date(session.completedAt));
          return (
            <Pressable
              key={session.workoutId}
              accessibilityRole="button"
              accessibilityLabel={t('exercises.openWorkout', { date })}
              onPress={() => onOpenWorkout(session.workoutId)}
              style={({ pressed }) => [
                styles.sessionRow,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
              ]}>
              <View style={styles.sessionHeader}>
                <Text variant="label">{date}</Text>
                {session.phase === 'deload' ? (
                  <Text variant="caption" tone="accent">
                    {t('exercises.deloadBadge')}
                  </Text>
                ) : null}
              </View>
              {groupByWeight(session).map(([weight, reps]) => (
                <Text key={weight} tabular tone="secondary">
                  {t('exercises.sessionGroup', { weight: kg(weight), reps: reps.join(', ') })}
                </Text>
              ))}
            </Pressable>
          );
        })}
      </View>

      {similar.length > 0 ? (
        <Card testID="exercise-similar">
          <Text variant="heading">{t('exercises.similarTitle')}</Text>
          {similar.map((item) => {
            const itemName = exerciseName(item, locale);
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={t('exercises.openSimilar', { name: itemName })}
                onPress={() => onOpenExercise(item.id)}
                style={styles.similarRow}>
                <Text variant="label">
                  {t('exercises.similarItem', {
                    name: itemName,
                    equipment: t(equipmentLabelKey(item.equipment)),
                  })}
                </Text>
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      <Button label={t('exercises.seeProgress')} onPress={() => onOpenProgress(exercise.id)} />
      <Button
        variant="secondary"
        label={t('exercises.howTo')}
        onPress={() => openUrl(videoSearchUrl(name))}
      />

      {exercise.custom ? (
        <View style={styles.actions}>
          <Button
            variant="secondary"
            label={t('common.edit')}
            onPress={() => {
              setMessage(null);
              setEditing(true);
            }}
          />
          <Button
            variant="secondary"
            label={exercise.archived ? t('exercises.restore') : t('exercises.archive')}
            onPress={() => void run(() => setExerciseArchived(exercise.id, !exercise.archived))}
          />
          <Button
            variant="secondary"
            label={t('common.delete')}
            onPress={() => {
              setMessage(null);
              setConfirmingDelete(true);
            }}
          />
        </View>
      ) : null}

      <ConfirmDialog
        visible={confirmingDelete}
        title={t('exercises.deleteTitle')}
        message={t('exercises.deleteMessage', { name })}
        confirmLabel={t('common.delete')}
        destructive
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false);
          void run(() => deleteCustomExercise(exercise.id)).then((deleted) => {
            if (deleted) onBack();
          });
        }}
      />
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  editTop: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  titleBlock: { gap: spacing.xs },
  badges: { flexDirection: 'row', gap: spacing.sm },
  fact: { gap: spacing.xs / 2 },
  record: { gap: spacing.xs / 2 },
  history: { gap: spacing.sm },
  sessionRow: {
    minHeight: layout.minTouchTarget,
    gap: spacing.xs,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pressed: { opacity: 0.6 },
  noteInput: {
    minHeight: 88,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    textAlignVertical: 'top',
  },
  similarRow: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    gap: spacing.xs / 2,
  },
});
