import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';
import { PLAN_LIMITS } from '@/domain/plan';
import {
  resolveParams,
  validateParams,
  type ConfigurableParam,
  type ProgramParams,
  type ProgramTemplate,
} from '@/domain/program';
import { REFERENCE_MAX_LIMITS, validateMaxKg } from '@/domain/reference-max';
import { useI18n, type MessageKey } from '@/i18n';
import { findProgram } from '@/library';
import { useAppStore } from '@/state/app-store-context';
import {
  PlanValidationError,
  ReferenceMaxValidationError,
  UnknownProgramError,
} from '@/state/errors';
import { selectAllExercises, selectCurrentMaxes, selectFindExercise } from '@/state/selectors';

import { EmptyState, ExerciseSelectModal, exerciseName } from '../shared';
import { useTheme } from '../theme-provider';
import { Button, Card, NumberInput, Screen, Text, TextField } from '../ui';
import { toPercentPoints } from './program-weeks';
import { useProgramText } from './set-label';

export type ProgramStartScreenProps = {
  programId: string;
  onBack: () => void;
  /** Called with the id of the created (and activated) plan. */
  onCreated: (planId: number) => void;
};

type Entry = { value: number | null; invalid: boolean };

const hasAccessories = (program: ProgramTemplate): boolean =>
  program.weeks.some((week) => week.days.some((day) => day.items.some((item) => item.kind === 'accessory')));

/** What the user edits for a parameter: kg as they are, fractions as percentage points. */
const toEdited = (param: ConfigurableParam, value: number): number =>
  param.unit === 'fraction' ? toPercentPoints(value) : value;
const fromEdited = (param: ConfigurableParam, value: number): number =>
  param.unit === 'fraction' ? Math.round(value * 100) / 10_000 : value;

/** Programs → start (SPEC-v4 §10.2, journey §1.2 step 3): map the roles, set the parameters and 1RMs, create the plan. */
export function ProgramStartScreen({ programId, onBack, onCreated }: ProgramStartScreenProps) {
  const program = findProgram(programId);
  if (!program) return <UnknownProgram onBack={onBack} />;
  return <StartForm program={program} onBack={onBack} onCreated={onCreated} />;
}

function UnknownProgram({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  return (
    <Screen testID="screen-program-start">
      <Button variant="secondary" label={t('common.back')} onPress={onBack} />
      <EmptyState title={t('programs.detail.notFoundTitle')} message={t('programs.detail.notFoundMessage')} />
    </Screen>
  );
}

function StartForm({
  program,
  onBack,
  onCreated,
}: {
  program: ProgramTemplate;
  onBack: () => void;
  onCreated: (planId: number) => void;
}) {
  const { t, locale, formatKg } = useI18n();
  const { colors } = useTheme();
  const text = useProgramText();
  const startProgram = useAppStore((s) => s.startProgram);
  const exercises = useAppStore(selectAllExercises);
  const findExercise = useAppStore(selectFindExercise);
  const currentMaxes = useAppStore(selectCurrentMaxes);

  const [name, setName] = useState(program.name);
  const [roles, setRoles] = useState<Record<string, string | undefined>>(() =>
    Object.fromEntries(program.roles.map((role) => [role.id, role.defaultExerciseId])),
  );
  const [params, setParams] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(
      (program.configurable ?? []).map((param) => [
        param.id,
        { value: toEdited(param, resolveParams(program)[param.id]), invalid: false },
      ]),
    ),
  );
  const [accessories, setAccessories] = useState(true);
  const [edited, setEdited] = useState<Record<string, Entry>>({});
  const [selecting, setSelecting] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const paramRules = useMemo(
    () =>
      Object.fromEntries(
        (program.configurable ?? []).map((param) => [
          param.id,
          {
            required: true,
            min: toEdited(param, param.min),
            max: toEdited(param, param.max),
            ...(param.step !== undefined ? { step: toEdited(param, param.step) } : {}),
            maxDecimals: 2,
          },
        ]),
      ),
    [program],
  );
  const maxRules = useMemo(
    () => ({
      min: REFERENCE_MAX_LIMITS.min,
      minExclusive: true,
      max: REFERENCE_MAX_LIMITS.max,
      maxDecimals: REFERENCE_MAX_LIMITS.maxDecimals,
    }),
    [],
  );

  const nameOf = (exerciseId: string): string => {
    const exercise = findExercise(exerciseId);
    return exercise ? exerciseName(exercise, locale) : exerciseId;
  };

  const mapped = useMemo(() => {
    const ids: string[] = [];
    for (const role of program.roles) {
      const id = roles[role.id];
      if (id !== undefined && !ids.includes(id)) ids.push(id);
    }
    return ids;
  }, [program, roles]);

  const maxValue = (exerciseId: string): number | null =>
    exerciseId in edited ? edited[exerciseId].value : (currentMaxes[exerciseId]?.kg ?? null);

  const unsetRoles = program.roles.filter((role) => roles[role.id] === undefined);

  const submit = async () => {
    if (busy) return;
    setShowErrors(true);
    const problems: string[] = [];
    const trimmed = name.trim();
    if (trimmed === '') problems.push(t('programs.start.errors.nameRequired'));
    else if (trimmed.length > PLAN_LIMITS.planName.max) problems.push(t('programs.start.errors.nameTooLong'));
    if (unsetRoles.length > 0) problems.push(t('programs.start.errors.rolesMissing'));

    const values: ProgramParams = {};
    let fieldsInvalid = false;
    for (const param of program.configurable ?? []) {
      const entry = params[param.id];
      if (entry.value === null || entry.invalid) fieldsInvalid = true;
      else values[param.id] = fromEdited(param, entry.value);
    }
    for (const issue of validateParams(program, values)) {
      const param = program.configurable?.find((candidate) => candidate.id === issue.param);
      const label = param ? text(param.label) : issue.param;
      problems.push(
        issue.code === 'paramOutOfRange'
          ? t('programs.start.errors.paramOutOfRange', { label })
          : issue.code === 'paramOffStep'
            ? t('programs.start.errors.paramOffStep', { label })
            : t('programs.start.errors.paramInvalid', { label }),
      );
    }

    const maxes: { exerciseId: string; kg: number }[] = [];
    for (const exerciseId of mapped) {
      const entry = exerciseId in edited ? edited[exerciseId] : undefined;
      if (entry?.invalid) {
        fieldsInvalid = true;
        continue;
      }
      const kg = maxValue(exerciseId);
      if (kg === null) continue;
      if (validateMaxKg(kg) !== null) {
        problems.push(t('programs.start.errors.maxInvalid'));
        continue;
      }
      if (currentMaxes[exerciseId]?.kg !== kg) maxes.push({ exerciseId, kg });
    }
    if (fieldsInvalid) problems.push(t('programs.start.errors.fixValues'));
    if (problems.length > 0) {
      setErrors(problems);
      return;
    }

    setErrors([]);
    setBusy(true);
    try {
      const planId = await startProgram({
        programId: program.id,
        name: trimmed,
        roles: roles as Record<string, string>,
        ...((program.configurable?.length ?? 0) > 0 ? { params: values } : {}),
        accessories: hasAccessories(program) && accessories,
        maxes,
        locale,
      });
      onCreated(planId);
    } catch (error) {
      setErrors(describeError(error));
      setBusy(false);
    }
  };

  const describeError = (error: unknown): string[] => {
    if (error instanceof UnknownProgramError) return [t('programs.start.errors.unknownProgram')];
    if (error instanceof ReferenceMaxValidationError) return [t('programs.start.errors.maxInvalid')];
    if (error instanceof PlanValidationError) {
      return [
        t('programs.start.errors.createFailed'),
        ...error.issues.map((issue) =>
          t('planImport.preview.issue', {
            path: issue.path,
            message: t(`planImport.issues.${issue.code}` as MessageKey),
          }),
        ),
      ];
    }
    return [t('programs.start.errors.createFailed')];
  };

  const selectingRole = selecting ? program.roles.find((role) => role.id === selecting) : undefined;
  const defaultExercise = selectingRole?.defaultExerciseId
    ? findExercise(selectingRole.defaultExerciseId)
    : undefined;

  return (
    <Screen title={t('programs.start.title', { name: program.name })} testID="screen-program-start">
      <Button variant="secondary" label={t('common.back')} onPress={onBack} />

      <TextField
        label={t('programs.start.nameLabel')}
        value={name}
        onChangeText={setName}
        error={
          showErrors && name.trim() === ''
            ? t('programs.start.errors.nameRequired')
            : showErrors && name.trim().length > PLAN_LIMITS.planName.max
              ? t('programs.start.errors.nameTooLong')
              : null
        }
      />

      <Card>
        <Text variant="heading">{t('programs.start.rolesTitle')}</Text>
        <Text tone="secondary">{t('programs.start.rolesIntro')}</Text>
        {program.roles.map((role) => {
          const exerciseId = roles[role.id];
          const original = role.defaultExerciseId;
          const departs = role.fixedInOriginal === true && exerciseId !== undefined && original !== undefined && exerciseId !== original;
          return (
            <View key={role.id} style={styles.entry} testID={`role-${role.id}`}>
              <Button
                variant="secondary"
                label={exerciseId ? nameOf(exerciseId) : t('programs.start.roleUnset')}
                accessibilityLabel={t('programs.start.roleButton', {
                  role: text(role.label),
                  exercise: exerciseId ? nameOf(exerciseId) : t('programs.start.roleUnset'),
                })}
                onPress={() => setSelecting(role.id)}
              />
              {departs && original && exerciseId ? (
                <Text variant="caption" tone="accent">
                  {t('programs.start.fidelity', { original: nameOf(original), exercise: nameOf(exerciseId) })}
                </Text>
              ) : null}
              {showErrors && exerciseId === undefined ? (
                <Text variant="caption" tone="danger">
                  {t('programs.start.errors.rolesMissing')}
                </Text>
              ) : null}
            </View>
          );
        })}
      </Card>

      {program.configurable && program.configurable.length > 0 ? (
        <Card>
          <Text variant="heading">{t('programs.start.paramsTitle')}</Text>
          {program.configurable.map((param) => (
            <NumberInput
              key={param.id}
              label={text(param.label)}
              unit={param.unit === 'kg' ? t('common.kg') : t('programs.start.percentUnit')}
              value={params[param.id].value}
              rules={paramRules[param.id]}
              onChange={({ value, error }) =>
                setParams((current) => ({
                  ...current,
                  [param.id]: { value, invalid: error !== null },
                }))
              }
            />
          ))}
        </Card>
      ) : null}

      {hasAccessories(program) ? (
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={t('programs.start.accessoriesLabel')}
          accessibilityHint={t('programs.start.accessoriesHint')}
          accessibilityState={{ checked: accessories }}
          onPress={() => setAccessories((value) => !value)}
          style={[styles.toggle, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={styles.grow}>{t('programs.start.accessoriesLabel')}</Text>
          <Text tone={accessories ? 'accent' : 'secondary'}>{accessories ? t('common.yes') : t('common.no')}</Text>
        </Pressable>
      ) : null}

      {mapped.length > 0 ? (
        <Card>
          <Text variant="heading">{t('programs.start.maxesTitle')}</Text>
          <Text tone="secondary">{t('programs.start.maxesIntro')}</Text>
          {mapped.map((exerciseId) => (
            <View key={exerciseId} style={styles.entry}>
              <NumberInput
                label={t('programs.start.maxLabel', { exercise: nameOf(exerciseId) })}
                unit={t('common.kg')}
                value={maxValue(exerciseId)}
                rules={maxRules}
                onChange={({ value, error }) =>
                  setEdited((current) => ({ ...current, [exerciseId]: { value, invalid: error !== null } }))
                }
              />
              {currentMaxes[exerciseId] ? (
                <Text variant="caption" tone="secondary">
                  {t('programs.start.maxCurrent', { kg: formatKg(currentMaxes[exerciseId].kg) })}
                </Text>
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}

      {errors.length > 0 ? (
        <Card testID="start-errors" accessibilityLiveRegion="polite">
          {errors.map((message, index) => (
            <Text key={index} tone="danger">
              {message}
            </Text>
          ))}
        </Card>
      ) : null}
      <Button label={t('programs.start.create')} onPress={submit} disabled={busy} />

      <ExerciseSelectModal
        visible={selectingRole !== undefined}
        title={t('programs.start.pickerTitle', { role: selectingRole ? text(selectingRole.label) : '' })}
        exercises={exercises.filter((exercise) => !exercise.archived)}
        suggested={defaultExercise ? [defaultExercise] : []}
        onSelect={(exercise) => {
          if (selecting) setRoles((current) => ({ ...current, [selecting]: exercise.id }));
          setSelecting(null);
        }}
        onClose={() => setSelecting(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  entry: { gap: spacing.xs },
  grow: { flex: 1 },
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
