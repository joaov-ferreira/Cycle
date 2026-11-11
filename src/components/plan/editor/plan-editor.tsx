import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import {
  PLAN_LIMITS,
  validatePlanContent,
  type Plan,
  type PlanContent,
  type PlanIssue,
} from '@/domain/plan';
import { useI18n } from '@/i18n';
import { findProgram } from '@/library';
import { PlanValidationError } from '@/state/errors';
import { useAppStore } from '@/state/app-store-context';
import { selectAllExercises, selectFindExercise } from '@/state/selectors';

import { ConfirmDialog, ExerciseSelectModal, Stepper, exerciseName } from '../../shared';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import {
  followWorkoutCount,
  moveItem,
  newPlanExercise,
  newWorkoutId,
  pickWorkoutName,
  removeBlock,
} from './draft-ops';
import { newBlockId } from './block-ops';
import { EditorContextProvider, type PickRequest } from './editor-context';
import { issueMessage, parseIssuePath } from './issues';
import { MultilineField } from './multiline-field';
import { linkWithNext, normalizeSupersets, unlinkAt } from './superset-ops';
import { WorkoutCard } from './workout-card';

export type PlanEditorProps = {
  /** The content the draft starts from (a copy is edited; nothing is persisted until Save). */
  initial: PlanContent;
  /** `null` creates a new plan, a number updates that plan. */
  planId: number | null;
  onSaved: (plan: Plan) => void;
  onCancel: () => void;
};

type SaveProblem = 'invalidInput' | 'failed' | null;

/** Trims the texts the user typed; the rest of the draft is saved as it is. */
function normalize(draft: PlanContent): PlanContent {
  return {
    ...draft,
    name: draft.name.trim(),
    description: draft.description.trim(),
    workouts: draft.workouts.map((workout) => ({ ...workout, name: workout.name.trim() })),
  };
}

export function PlanEditor({ initial, planId, onSaved, onCancel }: PlanEditorProps) {
  const { t, locale, formatNumber } = useI18n();
  const findExercise = useAppStore(selectFindExercise);
  const allExercises = useAppStore(selectAllExercises);
  const createPlan = useAppStore((s) => s.createPlan);
  const updatePlan = useAppStore((s) => s.updatePlan);
  const createCustomExercise = useAppStore((s) => s.createCustomExercise);

  const [initialJson] = useState(() => JSON.stringify(initial));
  const [draft, setDraft] = useState<PlanContent>(initial);
  /** Sessions per week follows the workout count until the user sets it by hand. */
  const sessionsByHand = useRef(planId !== null && initial.sessionsPerWeek !== initial.workouts.length);
  const [attempted, setAttempted] = useState(false);
  const [storeIssues, setStoreIssues] = useState<PlanIssue[] | null>(null);
  const [problem, setProblem] = useState<SaveProblem>(null);
  const [invalidLoads, setInvalidLoads] = useState<ReadonlySet<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [newExerciseIds, setNewExerciseIds] = useState<ReadonlySet<string>>(new Set());
  const [picker, setPicker] = useState<PickRequest | null>(null);
  const [removingWorkout, setRemovingWorkout] = useState<number | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const dirty = JSON.stringify(draft) !== initialJson;

  const issues = useMemo<PlanIssue[]>(() => {
    if (!attempted) return [];
    return storeIssues ?? validatePlanContent(normalize(draft), findExercise, { findProgram });
  }, [attempted, storeIssues, draft, findExercise]);

  const messages = useMemo(() => {
    const byPath: Record<string, string> = {};
    const other: string[] = [];
    for (const issue of issues) {
      const message = issueMessage(t, formatNumber, issue);
      if (parseIssuePath(issue.path).kind === 'other') other.push(message);
      else byPath[issue.path] ??= message;
    }
    return { byPath, other };
  }, [issues, t, formatNumber]);

  const edit = (change: (content: PlanContent) => PlanContent) => {
    setStoreIssues(null);
    setProblem(null);
    setDraft(change);
  };

  /** Applies a change to the workout list and keeps sessions per week in step with it. */
  const editWorkouts = (change: (content: PlanContent) => PlanContent) =>
    edit((content) => {
      const next = change(content);
      return sessionsByHand.current ? next : followWorkoutCount(next);
    });

  const exerciseLabel = (exerciseId: string) => {
    const exercise = findExercise(exerciseId);
    return exercise ? exerciseName(exercise, locale) : t('planEditor.unknownExercise');
  };

  const addWorkout = () =>
    editWorkouts((content) => ({
      ...content,
      workouts: [
        ...content.workouts,
        {
          id: newWorkoutId(content),
          name: pickWorkoutName(
            content.workouts.map((w) => w.name),
            (letter) => t('planEditor.defaultWorkoutName', { letter }),
          ),
          exercises: [],
        },
      ],
    }));

  const changeWorkout = (index: number, change: (workout: PlanContent['workouts'][number]) => PlanContent['workouts'][number]) =>
    edit((content) => ({
      ...content,
      workouts: content.workouts.map((workout, i) => (i === index ? change(workout) : workout)),
    }));

  const removeWorkout = (index: number) => {
    setRemovingWorkout(null);
    editWorkouts((content) => ({ ...content, workouts: content.workouts.filter((_, i) => i !== index) }));
  };

  const askToRemoveWorkout = (index: number) => {
    const workout = draft.workouts[index];
    if (workout.exercises.length === 0 && (workout.programs ?? []).length === 0) removeWorkout(index);
    else setRemovingWorkout(index);
  };

  const addExercise = (workoutId: string, exerciseId: string) => {
    const created = newPlanExercise(draft, exerciseId);
    setNewExerciseIds((current) => new Set(current).add(created.id));
    edit((content) => ({
      ...content,
      workouts: content.workouts.map((workout) =>
        workout.id === workoutId ? { ...workout, exercises: [...workout.exercises, created] } : workout,
      ),
    }));
  };

  const setLoadInvalid = (planExerciseId: string, invalid: boolean) =>
    setInvalidLoads((current) => {
      if (current.has(planExerciseId) === invalid) return current;
      const next = new Set(current);
      if (invalid) next.add(planExerciseId);
      else next.delete(planExerciseId);
      return next;
    });

  const save = async () => {
    if (saving) return;
    setAttempted(true);
    if (invalidLoads.size > 0) {
      setProblem('invalidInput');
      return;
    }
    const content = normalize(draft);
    if (validatePlanContent(content, findExercise, { findProgram }).length > 0) return;
    setSaving(true);
    try {
      const plan = planId === null ? await createPlan(content) : await updatePlan(planId, content);
      onSaved(plan);
    } catch (error) {
      if (error instanceof PlanValidationError) setStoreIssues(error.issues);
      else setProblem('failed');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => (dirty ? setConfirmingDiscard(true) : onCancel());

  const removing = removingWorkout === null ? null : draft.workouts[removingWorkout];
  const editorContext = useMemo(
    () => ({
      pickExercise: setPicker,
      exerciseLabel,
      exerciseExists: (exerciseId: string) => findExercise(exerciseId) !== undefined,
    }),
    // `exerciseLabel` is rebuilt every render but only depends on these two.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [findExercise, locale, t],
  );
  const removingName = removing
    ? removing.name.trim() || t('planEditor.workoutFallback', { number: (removingWorkout ?? 0) + 1 })
    : '';
  const hasIssues = issues.length > 0;

  return (
    <EditorContextProvider value={editorContext}>
    <Screen title={planId === null ? t('planEditor.newTitle') : t('planEditor.title')} testID="screen-plan-edit">
      <View style={styles.actions}>
        <Button variant="secondary" label={t('common.cancel')} onPress={cancel} />
        <Button label={t('common.save')} onPress={save} disabled={saving} />
      </View>

      {hasIssues ? (
        <Text tone="danger" accessibilityLiveRegion="polite">
          {t('planEditor.problems')}
        </Text>
      ) : null}
      {problem === 'invalidInput' ? (
        <Text tone="danger" accessibilityLiveRegion="polite">
          {t('planEditor.invalidInput')}
        </Text>
      ) : null}
      {problem === 'failed' ? (
        <Text tone="danger" accessibilityLiveRegion="polite">
          {t('planEditor.saveFailed')}
        </Text>
      ) : null}
      {messages.other.map((message) => (
        <Text key={message} variant="caption" tone="danger">
          {message}
        </Text>
      ))}

      <TextField
        label={t('planEditor.nameLabel')}
        value={draft.name}
        onChangeText={(name) => edit((content) => ({ ...content, name }))}
        error={messages.byPath.name}
      />
      <MultilineField
        label={t('planEditor.descriptionLabel')}
        value={draft.description}
        onChangeText={(description) => edit((content) => ({ ...content, description }))}
        error={messages.byPath.description}
      />

      <View style={styles.sessions}>
        <Text variant="label">{t('planEditor.sessionsPerWeek')}</Text>
        <Stepper
          label={t('planEditor.sessionsPerWeek')}
          value={draft.sessionsPerWeek}
          min={PLAN_LIMITS.sessionsPerWeek.min}
          max={PLAN_LIMITS.sessionsPerWeek.max}
          onChange={(sessionsPerWeek) => {
            sessionsByHand.current = true;
            edit((content) => ({ ...content, sessionsPerWeek }));
          }}
        />
        {messages.byPath.sessionsPerWeek ? (
          <Text variant="caption" tone="danger">
            {messages.byPath.sessionsPerWeek}
          </Text>
        ) : null}
      </View>

      <Text variant="heading">{t('planEditor.workoutsHeading')}</Text>
      {draft.workouts.length === 0 ? <Text tone="secondary">{t('planEditor.noWorkouts')}</Text> : null}
      {messages.byPath.workouts ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {messages.byPath.workouts}
        </Text>
      ) : null}
      {draft.workouts.map((workout, index) => (
        <WorkoutCard
          key={workout.id}
          workout={workout}
          index={index}
          isFirst={index === 0}
          isLast={index === draft.workouts.length - 1}
          errors={messages.byPath}
          exerciseLabel={exerciseLabel}
          onRename={(name) => changeWorkout(index, (w) => ({ ...w, name }))}
          onMove={(delta) => editWorkouts((content) => ({ ...content, workouts: moveItem(content.workouts, index, delta) }))}
          onRemove={() => askToRemoveWorkout(index)}
          onAddExercise={() =>
            setPicker({
              title: t('planEditor.pickerTitle'),
              onSelect: (exerciseId) => addExercise(workout.id, exerciseId),
            })
          }
          newBlockId={newBlockId(draft)}
          findProgram={findProgram}
          onAddBlock={(block) =>
            changeWorkout(index, (w) => ({ ...w, programs: [...(w.programs ?? []), block] }))
          }
          onChangeBlock={(blockIndex, block) =>
            changeWorkout(index, (w) => ({
              ...w,
              programs: (w.programs ?? []).map((b, i) => (i === blockIndex ? block : b)),
            }))
          }
          onMoveBlock={(blockIndex, delta) =>
            changeWorkout(index, (w) => ({ ...w, programs: moveItem(w.programs ?? [], blockIndex, delta) }))
          }
          onRemoveBlock={(blockIndex) =>
            changeWorkout(index, (w) => removeBlock(w, blockIndex))
          }
          onChangeExercise={(exerciseIndex, next) =>
            changeWorkout(index, (w) => ({
              ...w,
              exercises: w.exercises.map((e, i) => (i === exerciseIndex ? next : e)),
            }))
          }
          onMoveExercise={(exerciseIndex, delta) =>
            changeWorkout(index, (w) => ({
              ...w,
              exercises: normalizeSupersets(moveItem(w.exercises, exerciseIndex, delta)),
            }))
          }
          onRemoveExercise={(exerciseIndex) =>
            changeWorkout(index, (w) => ({
              ...w,
              exercises: normalizeSupersets(w.exercises.filter((_, i) => i !== exerciseIndex)),
            }))
          }
          onLinkExercise={(exerciseIndex) =>
            changeWorkout(index, (w) => ({ ...w, exercises: linkWithNext(w.exercises, exerciseIndex) }))
          }
          onUnlinkExercise={(exerciseIndex) =>
            changeWorkout(index, (w) => ({ ...w, exercises: unlinkAt(w.exercises, exerciseIndex) }))
          }
          onLoadInvalid={setLoadInvalid}
          newExerciseIds={newExerciseIds}
        />
      ))}
      <Button
        variant="secondary"
        label={t('planEditor.addWorkout')}
        disabled={draft.workouts.length >= PLAN_LIMITS.workouts.max}
        onPress={addWorkout}
      />

      <ExerciseSelectModal
        visible={picker !== null}
        title={picker?.title ?? ''}
        exercises={allExercises}
        onSelect={(exercise) => {
          const request = picker;
          setPicker(null);
          request?.onSelect(exercise.id);
        }}
        onClose={() => setPicker(null)}
        onCreateExercise={createCustomExercise}
      />
      <ConfirmDialog
        testID="remove-workout-dialog"
        visible={removing !== null}
        title={t('planEditor.removeWorkoutTitle', { name: removingName })}
        message={t('planEditor.removeWorkoutMessage', {
          count: (removing?.exercises.length ?? 0) + (removing?.programs ?? []).length,
        })}
        confirmLabel={t('common.remove')}
        destructive
        onConfirm={() => removingWorkout !== null && removeWorkout(removingWorkout)}
        onCancel={() => setRemovingWorkout(null)}
      />
      <ConfirmDialog
        testID="discard-dialog"
        visible={confirmingDiscard}
        title={t('planEditor.discardTitle')}
        message={t('planEditor.discardMessage')}
        confirmLabel={t('planEditor.discard')}
        cancelLabel={t('planEditor.keepEditing')}
        destructive
        onConfirm={() => {
          setConfirmingDiscard(false);
          onCancel();
        }}
        onCancel={() => setConfirmingDiscard(false)}
      />
    </Screen>
    </EditorContextProvider>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  sessions: { gap: spacing.xs },
});
