import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';
import type { CustomExerciseInput, Exercise } from '@/domain/exercise';
import { normalizeName } from '@/domain/exercise-match';
import { PLAN_LIMITS, supersetLayout, type Plan } from '@/domain/plan';
import {
  PENDING_PREFIX,
  resolveDraft,
  unresolvedReferences,
  type DraftExercise,
  type DraftProgramLink,
  type ExerciseRef,
  type ImportDraft,
  type Resolution,
} from '@/domain/plan-import';
import { useI18n, type MessageKey } from '@/i18n';
import { findProgram } from '@/library/programs';
import { useAppStore } from '@/state/app-store-context';
import { CustomExerciseValidationError, PlanValidationError } from '@/state/errors';
import { selectImportMaxesPreview } from '@/state/selectors-v4';

import { useSetLabel } from '../programs/set-label';
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
  /** The plan to offer updating (else the active plan); preselects "Update plan" when valid. */
  updatePlanId?: number;
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
export function ImportPreviewStep({
  draft,
  exercises,
  onImported,
  updatePlanId,
  onEditText,
}: ImportPreviewStepProps) {
  const { t, locale, formatDate, formatNumber, formatKg } = useI18n();
  const setLabel = useSetLabel();
  const { colors } = useTheme();
  const targetLabel = useTargetLabel();
  const importPlan = useAppStore((s) => s.importPlan);
  const updatePlanFromImport = useAppStore((s) => s.updatePlanFromImport);
  const target = useAppStore((s) => {
    const requested = updatePlanId === undefined ? undefined : s.plans.find((p) => p.id === updatePlanId);
    if (requested) return requested;
    return s.activePlanId === null ? undefined : s.plans.find((p) => p.id === s.activePlanId);
  });
  const [mode, setMode] = useState<'new' | 'update'>(
    updatePlanId !== undefined && target?.id === updatePlanId ? 'update' : 'new',
  );
  const updating = mode === 'update' && target !== undefined;
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

  const resolved = useMemo(() => resolveDraft(draft, resolutions), [draft, resolutions]);
  const pendingImport = resolved.ok ? resolved.pending : null;
  const maxesPreview = useAppStore((s) => (pendingImport ? selectImportMaxesPreview(s, pendingImport) : null));

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

  /** Name shown for an exercise reference of the draft (line, scheme basis, role target). */
  const refName = (ref: ExerciseRef): { name: string; creates: boolean } => {
    if (ref.status === 'resolved') {
      const found = byId.get(ref.exerciseId);
      return { name: found ? exerciseName(found, locale) : ref.exerciseId, creates: false };
    }
    if (ref.status === 'newCustom') {
      return { name: customByKey.get(ref.key)?.name ?? ref.key, creates: true };
    }
    return chosenFor(normalizeName(ref.name)) ?? { name: ref.name, creates: false };
  };
  const lineName = (exercise: DraftExercise) => refName(exercise.ref);

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

  /** "<name> (before update <date>)", the name shortened so the whole fits the plan-name limit. */
  const backupNameFor = (name: string): string => {
    const date = formatDate(new Date());
    const room = PLAN_LIMITS.planName.max - t('planImport.preview.backupName', { name: '', date }).length;
    return t('planImport.preview.backupName', { name: name.slice(0, Math.max(room, 1)).trimEnd(), date });
  };

  const save = async () => {
    if (busy || remaining > 0) return;
    const result = resolved;
    if (!result.ok) return;
    setBusy(true);
    setSaveErrors([]);
    try {
      const plan =
        updating && target
          ? await updatePlanFromImport(target.id, result.pending, { backupName: backupNameFor(target.name) })
          : await importPlan(result.pending, { activate });
      onImported(plan);
    } catch (error) {
      setSaveErrors(describeSaveError(error));
      setBusy(false);
    }
  };

  const supersetHeading = (size: 2 | 3 | 4): string =>
    size === 2
      ? t('planImport.preview.supersetOf2')
      : size === 3
        ? t('planImport.preview.supersetOf3')
        : t('planImport.preview.supersetOf4');

  /** The weeks of a percent scheme as `Week 1: 3 × 5 @ 75 %`, with the basis exercise when it differs. */
  const renderScheme = (exercise: DraftExercise) => {
    const { percent } = exercise;
    if (!percent) return null;
    return (
      <View style={styles.scheme} testID="import-scheme">
        {percent.of ? (
          <Text variant="caption" tone="secondary">
            {t('planImport.preview.schemeBasis', { exercise: refName(percent.of.ref).name })}
          </Text>
        ) : null}
        {percent.weeks.map((week, index) => (
          <Text key={index} variant="caption" tabular>
            {week.sets.length === 0
              ? t('planImport.preview.schemeRest', { week: formatNumber(index + 1) })
              : t('planImport.preview.schemeWeek', {
                  week: formatNumber(index + 1),
                  groups: week.sets
                    .map((set) =>
                      setLabel({
                        sets: set.repeat ?? 1,
                        reps: set.reps,
                        ...(set.percent !== undefined ? { percent: set.percent } : {}),
                        ...(set.amrap ? { amrap: true } : {}),
                        ...(set.addKg !== undefined ? { add: { kind: 'kg' as const, kg: set.addKg } } : {}),
                      }),
                    )
                    .join(', '),
                })}
          </Text>
        ))}
      </View>
    );
  };

  const renderLine = (exercise: DraftExercise) => {
    const shown = lineName(exercise);
    return (
      <View key={exercise.id} style={styles.line}>
        <View style={styles.row}>
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
        {renderScheme(exercise)}
      </View>
    );
  };

  /** `Smolov Jr. · day 1 → Back Squat`, with the program week it starts at and the accessories. */
  const renderBlock = (link: DraftProgramLink) => {
    const targets = [...new Set(Object.values(link.roles).map((role) => refName(role.ref).name))];
    return (
      <View key={link.id} style={styles.line} testID="import-program-block">
        <Text variant="label" tone="accent">
          {t('planImport.preview.blockLine', {
            program: findProgram(link.programId)?.name ?? link.programId,
            day: formatNumber(link.day),
            exercise: targets.join(', '),
          })}
        </Text>
        <Text variant="caption" tone="secondary">
          {t('planImport.preview.blockWeek', { week: formatNumber(link.startWeek) })}
        </Text>
        {link.accessories ? (
          <Text variant="caption" tone="secondary">
            {t('planImport.preview.blockAccessories')}
          </Text>
        ) : null}
      </View>
    );
  };

  /** Name of the exercise of a reference 1RM; those still to be created are named by their draft. */
  const maxName = (exerciseId: string): string => {
    if (exerciseId.startsWith(PENDING_PREFIX)) {
      const key = exerciseId.slice(PENDING_PREFIX.length);
      return pendingImport?.customExercises.find((custom) => custom.key === key)?.name ?? key;
    }
    const exercise = byId.get(exerciseId);
    return exercise ? exerciseName(exercise, locale) : exerciseId;
  };
  const keptMaxes = new Map((maxesPreview?.kept ?? []).map((max) => [max.exerciseId, max]));
  const settingMaxes = maxesPreview?.willSet ?? [];

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
        {draft.cycle.rirRamp ? (
          <Text>
            {t('planImport.preview.rirRamp', {
              start: formatNumber(draft.cycle.rirRamp.start),
              end: formatNumber(draft.cycle.rirRamp.end),
            })}
          </Text>
        ) : null}
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
          {(workout.programs ?? []).map(renderBlock)}
          {workout.exercises.length > 0 ? (
            <Text variant="caption" tone="secondary">
              {t('planImport.preview.workoutExercises', { count: workout.exercises.length })}
            </Text>
          ) : null}
          {supersetLayout(workout.exercises).map((block) => {
            const lines = block.indices.map((index) => renderLine(workout.exercises[index]));
            if (block.label === null) return lines;
            const size = Math.min(Math.max(block.indices.length, 2), 4) as 2 | 3 | 4;
            return (
              <View
                key={workout.exercises[block.indices[0]].id}
                testID="import-superset"
                style={[styles.superset, { borderColor: colors.accent }]}>
                <Text variant="label" tone="accent">
                  {supersetHeading(size)}
                </Text>
                {lines}
              </View>
            );
          })}
        </Card>
      ))}

      {keptMaxes.size > 0 || settingMaxes.length > 0 ? (
        <Card testID="import-maxes">
          <Text variant="heading">{t('planImport.preview.maxesTitle')}</Text>
          {settingMaxes.length > 0 ? (
            <>
              <Text variant="label">{t('planImport.preview.maxesWillSet')}</Text>
              {settingMaxes.map((max) => (
                <Text key={max.exerciseId} tabular>
                  {t('planImport.preview.maxWillSet', { exercise: maxName(max.exerciseId), kg: formatKg(max.kg) })}
                </Text>
              ))}
            </>
          ) : null}
          {keptMaxes.size > 0 ? (
            <>
              <Text variant="label">{t('planImport.preview.maxesKept')}</Text>
              {[...keptMaxes.values()].map((max) => (
                <Text key={max.exerciseId} tabular>
                  {t('planImport.preview.maxKept', {
                    exercise: maxName(max.exerciseId),
                    kg: formatKg(max.kg),
                    current: formatKg(max.currentKg),
                  })}
                </Text>
              ))}
            </>
          ) : null}
        </Card>
      ) : null}

      {target ? (
        <View style={styles.section} accessibilityRole="radiogroup" accessibilityLabel={t('planImport.preview.saveTargetLabel')}>
          <Text variant="label">{t('planImport.preview.saveTargetLabel')}</Text>
          {(['new', 'update'] as const).map((option) => {
            const label =
              option === 'new'
                ? t('planImport.preview.saveAsNew')
                : t('planImport.preview.updatePlan', { name: target.name });
            const selected = mode === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ checked: selected }}
                onPress={() => setMode(option)}
                style={[
                  styles.toggle,
                  { borderColor: selected ? colors.accent : colors.border, backgroundColor: colors.surface },
                ]}>
                <Text style={styles.rowName}>{label}</Text>
                <Text tone={selected ? 'accent' : 'secondary'}>{selected ? '●' : '○'}</Text>
              </Pressable>
            );
          })}
          {updating ? <Text tone="secondary">{t('planImport.preview.updateNote')}</Text> : null}
        </View>
      ) : null}

      {updating ? null : (
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={t('planImport.preview.activate')}
          accessibilityState={{ checked: activate }}
          onPress={() => setActivate((value) => !value)}
          style={[styles.toggle, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={styles.rowName}>{t('planImport.preview.activate')}</Text>
          <Text tone={activate ? 'accent' : 'secondary'}>{activate ? t('common.yes') : t('common.no')}</Text>
        </Pressable>
      )}

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
      <Button
        label={updating ? t('planImport.preview.update') : t('planImport.preview.save')}
        onPress={save} disabled={remaining > 0 || busy} />

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
  line: { gap: spacing.xs },
  scheme: { gap: 2, paddingLeft: spacing.md },
  rowName: { flex: 1 },
  superset: { gap: spacing.xs, borderLeftWidth: 3, paddingLeft: spacing.md },
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
