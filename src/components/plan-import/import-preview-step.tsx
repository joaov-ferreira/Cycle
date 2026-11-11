import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';
import type { CustomExerciseInput, Exercise } from '@/domain/exercise';
import { normalizeName } from '@/domain/exercise-match';
import type { Plan } from '@/domain/plan';
import {
  resolveDraft,
  unresolvedReferences,
  type DraftExercise,
  type ImportDraft,
  type Resolution,
} from '@/domain/plan-import';
import { useI18n, type MessageKey } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';
import { CustomExerciseValidationError, PlanValidationError } from '@/state/errors';

import { ExerciseSelectModal, exerciseName } from '../shared';
import { useTheme } from '../theme-provider';
import { Button, Card, Text } from '../ui';
import { CreateExerciseModal } from './create-exercise-modal';
import { useTargetLabel } from './messages';
import { UnresolvedItem } from './unresolved-item';

export type ImportPreviewStepProps = {
  draft: ImportDraft;
  /** Every exercise (built-in first, then custom), archived ones included. */
  exercises: readonly Exercise[];
  onImported: (plan: Plan) => void;
  /** Back to the text, which stays as it was. */
  onEditText: () => void;
};

/** A stand-in for an exercise that does not exist yet, for name-collision checks. */
function pendingExercise(id: string, input: CustomExerciseInput): Exercise {
  return {
    id,
    name: { en: input.name, 'pt-BR': input.name },
    aliases: [],
    primaryMuscle: input.primaryMuscle,
    secondaryMuscles: input.secondaryMuscles,
    equipment: input.equipment,
    mechanics: input.mechanics,
    custom: true,
    archived: false,
  };
}

/** Step 2 of the import (SPEC §4.3): preview, resolution of unknown names, save. */
export function ImportPreviewStep({ draft, exercises, onImported, onEditText }: ImportPreviewStepProps) {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const targetLabel = useTargetLabel();
  const importPlan = useAppStore((s) => s.importPlan);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [selecting, setSelecting] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [activate, setActivate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);

  const byId = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises]);
  const customByKey = useMemo(
    () => new Map(draft.customExercises.map((custom) => [custom.key, custom])),
    [draft],
  );
  const unresolved = useMemo(() => unresolvedReferences(draft), [draft]);
  const selectable = useMemo(() => exercises.filter((exercise) => !exercise.archived), [exercises]);
  const remaining = unresolved.filter((item) => !resolutions[item.normalized]).length;

  const choose = (normalized: string, resolution: Resolution) => {
    setResolutions((current) => ({ ...current, [normalized]: resolution }));
    setSaveErrors([]);
  };
  const clear = (normalized: string) => {
    setResolutions((current) => {
      const next = { ...current };
      delete next[normalized];
      return next;
    });
  };

  const chosenFor = (normalized: string): { name: string; creates: boolean } | null => {
    const resolution = resolutions[normalized];
    if (!resolution) return null;
    if (resolution.kind === 'create') return { name: resolution.exercise.name, creates: true };
    const exercise = byId.get(resolution.exerciseId);
    return { name: exercise ? exerciseName(exercise, locale) : resolution.exerciseId, creates: false };
  };

  /** Name shown for an exercise line of the draft. */
  const lineName = (exercise: DraftExercise): { name: string; creates: boolean } => {
    const { ref } = exercise;
    if (ref.status === 'resolved') {
      const found = byId.get(ref.exerciseId);
      return { name: found ? exerciseName(found, locale) : ref.exerciseId, creates: false };
    }
    if (ref.status === 'newCustom') {
      return { name: customByKey.get(ref.key)?.name ?? ref.key, creates: true };
    }
    return chosenFor(normalizeName(ref.name)) ?? { name: ref.name, creates: false };
  };

  const othersFor = (normalized: string | null): Exercise[] => {
    const pending: Exercise[] = [];
    draft.customExercises.forEach((custom) => pending.push(pendingExercise(`pending:${custom.key}`, custom)));
    for (const [key, resolution] of Object.entries(resolutions)) {
      if (key !== normalized && resolution.kind === 'create') {
        pending.push(pendingExercise(`pending:${key}`, resolution.exercise));
      }
    }
    return [...exercises, ...pending];
  };

  const describeSaveError = (error: unknown): string[] => {
    if (error instanceof PlanValidationError) {
      return [
        t('planImport.preview.planIssues'),
        ...error.issues.map((issue) => {
          const key: MessageKey = `planImport.issues.${issue.code}`;
          return t('planImport.preview.issue', { path: issue.path, message: t(key) });
        }),
      ];
    }
    if (error instanceof CustomExerciseValidationError) {
      const messages = Object.entries(error.errors).map(([field, code]) =>
        t(`common.exerciseErrors.${field}.${code}` as MessageKey, { max: 60 }),
      );
      return [error.key ? `${error.key}` : t('planImport.preview.saveError'), ...messages];
    }
    return [t('planImport.preview.saveError')];
  };

  const save = async () => {
    if (busy || remaining > 0) return;
    const result = resolveDraft(draft, resolutions);
    if (!result.ok) return;
    setBusy(true);
    setSaveErrors([]);
    try {
      const plan = await importPlan(result.pending, { activate });
      onImported(plan);
    } catch (error) {
      setSaveErrors(describeSaveError(error));
      setBusy(false);
    }
  };

  const creatingItem = creating ? unresolved.find((item) => item.normalized === creating) : undefined;
  const existingCreate = creating && resolutions[creating]?.kind === 'create' ? resolutions[creating] : undefined;
  const selectingItem = selecting ? unresolved.find((item) => item.normalized === selecting) : undefined;

  return (
    <>
      <Button variant="secondary" label={t('planImport.preview.edit')} onPress={onEditText} />
      <Card testID="import-summary">
        <Text variant="title">{draft.name}</Text>
        {draft.description ? <Text tone="secondary">{draft.description}</Text> : null}
        <Text>
          {t('planImport.preview.cycle', {
            load: t('planImport.preview.loadWeeks', { count: draft.cycle.loadWeeks }),
            deload: t('planImport.preview.deloadWeeks', { count: draft.cycle.deloadWeeks }),
          })}
        </Text>
        <Text>{t('planImport.preview.sessionsPerWeek', { count: draft.sessionsPerWeek })}</Text>
      </Card>

      {unresolved.length > 0 ? (
        <View style={styles.section}>
          <Text variant="heading">{t('planImport.preview.unresolvedTitle')}</Text>
          <Text tone="secondary">{t('planImport.preview.unresolvedHint')}</Text>
          {unresolved.map((item) => (
            <UnresolvedItem
              key={item.normalized}
              testID={`unresolved-${item.normalized}`}
              name={item.name}
              suggestions={item.suggestions.flatMap((id) => byId.get(id) ?? [])}
              chosen={chosenFor(item.normalized)}
              onSuggestion={(exercise) => choose(item.normalized, { kind: 'existing', exerciseId: exercise.id })}
              onChooseAnother={() => setSelecting(item.normalized)}
              onCreateNew={() => setCreating(item.normalized)}
              onChange={() => clear(item.normalized)}
            />
          ))}
        </View>
      ) : null}

      {draft.workouts.map((workout) => (
        <Card key={workout.id}>
          <Text variant="heading">{workout.name}</Text>
          <Text variant="caption" tone="secondary">
            {t('planImport.preview.workoutExercises', { count: workout.exercises.length })}
          </Text>
          {workout.exercises.map((exercise) => {
            const shown = lineName(exercise);
            return (
              <View key={exercise.id} style={styles.row}>
                <View style={styles.rowName}>
                  <Text>{shown.name}</Text>
                  {shown.creates ? (
                    <Text variant="caption" tone="accent">
                      {t('planImport.preview.willBeCreated')}
                    </Text>
                  ) : null}
                </View>
                <Text tone="secondary" tabular>
                  {targetLabel(exercise.sets, exercise.repMin, exercise.repMax)}
                </Text>
              </View>
            );
          })}
        </Card>
      ))}

      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={t('planImport.preview.activate')}
        accessibilityState={{ checked: activate }}
        onPress={() => setActivate((value) => !value)}
        style={[styles.toggle, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={styles.rowName}>{t('planImport.preview.activate')}</Text>
        <Text tone={activate ? 'accent' : 'secondary'}>{activate ? t('common.yes') : t('common.no')}</Text>
      </Pressable>

      {remaining > 0 ? (
        <Text tone="secondary" accessibilityLiveRegion="polite">
          {t('planImport.preview.pending')} {t('planImport.preview.unresolvedCount', { count: remaining })}
        </Text>
      ) : null}
      {saveErrors.length > 0 ? (
        <Card testID="save-errors">
          {saveErrors.map((message, index) => (
            <Text key={index} tone="danger">
              {message}
            </Text>
          ))}
        </Card>
      ) : null}
      <Button label={t('planImport.preview.save')} onPress={save} disabled={remaining > 0 || busy} />

      <ExerciseSelectModal
        visible={selectingItem !== undefined}
        title={t('planImport.preview.chooseTitle')}
        exercises={selectable}
        suggested={selectingItem?.suggestions.flatMap((id) => byId.get(id) ?? []) ?? []}
        onSelect={(exercise) => {
          if (selecting) choose(selecting, { kind: 'existing', exerciseId: exercise.id });
          setSelecting(null);
        }}
        onClose={() => setSelecting(null)}
      />
      <CreateExerciseModal
        key={creating ?? 'none'}
        visible={creatingItem !== undefined}
        name={creatingItem?.name ?? ''}
        initial={existingCreate?.kind === 'create' ? existingCreate.exercise : undefined}
        others={othersFor(creating)}
        onSubmit={(input) => {
          if (creating) choose(creating, { kind: 'create', exercise: input });
          setCreating(null);
        }}
        onClose={() => setCreating(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowName: { flex: 1 },
  toggle: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
});
