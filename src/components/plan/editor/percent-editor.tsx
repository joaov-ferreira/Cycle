import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';
import { SCHEME_LIMITS, type PercentProgression } from '@/domain/percent-scheme';
import type { PlanExercise } from '@/domain/plan';
import type { SchemeSet } from '@/domain/scheme-set';
import { useI18n } from '@/i18n';

import { Stepper } from '../../shared';
import { useTheme } from '../../theme-provider';
import { Button } from '../../ui/Button';
import { NumberInput, type NumberInputChange } from '../../ui/NumberInput';
import { Text } from '../../ui/Text';
import { useEditorContext } from './editor-context';
import {
  addGroup,
  addWeek,
  copyPreviousWeek,
  removeGroup,
  removeWeek,
  setBasis,
  setStartWeek,
  updateGroup,
  withScheme,
} from './percent-ops';

const PERCENT_RULES = {
  min: SCHEME_LIMITS.percent.min,
  max: SCHEME_LIMITS.percent.max,
  step: SCHEME_LIMITS.percent.step,
  maxDecimals: 1,
};
const ADD_KG_RULES = {
  min: SCHEME_LIMITS.addKg.min,
  max: SCHEME_LIMITS.addKg.max,
  maxDecimals: SCHEME_LIMITS.addKg.maxDecimals,
};

export type PercentEditorProps = {
  exercise: PlanExercise & { percent: PercentProgression };
  /** The exercise's name in the UI language. */
  name: string;
  /** Raw issue path of the exercise, e.g. `workouts[0].exercises[1]`. */
  path: string;
  /** Localized issue messages by raw issue path. */
  errors: Record<string, string>;
  onChange: (next: PlanExercise) => void;
  /** Reports whether the field `key` holds text that is not a valid number. */
  onInvalid: (key: string, invalid: boolean) => void;
};

/**
 * The percent scheme of one exercise (SPEC-v4 §10.3): a list of weeks, each a list of groups
 * (sets × reps @ % [+ kg] [AMRAP]), "Copy previous week", the basis exercise and the start week.
 * An empty week is allowed: the exercise is then not trained that week.
 */
export function PercentEditor({ exercise, name, path, errors, onChange, onInvalid }: PercentEditorProps) {
  const { t } = useI18n();
  const { exerciseLabel, pickExercise } = useEditorContext();
  const { percent } = exercise;
  // Removing a week or group shifts the fields under it: remounting them from the draft keeps
  // each field's text and its "invalid" flag in step with the values.
  const [generation, setGeneration] = useState(0);
  const update = (next: PercentProgression, structural = false) => {
    if (structural) setGeneration((g) => g + 1);
    onChange(withScheme(exercise, next));
  };
  const error = (field: string) => errors[`${path}.percent.${field}`];
  const basisId = percent.basisExerciseId;

  return (
    <View style={styles.container} testID={`percent-editor-${exercise.id}`}>
      <Text tone="secondary" variant="caption">
        {t('planEditor.percent.noRirNote')}
      </Text>

      <View style={styles.basis}>
        <Text variant="label">{t('planEditor.percent.basis')}</Text>
        <View style={styles.row}>
          <Text>{exerciseLabel(basisId ?? exercise.exerciseId)}</Text>
          <Button
            variant="secondary"
            label={t('planEditor.percent.basisChange')}
            accessibilityLabel={t('planEditor.percent.basisChangeOf', { exercise: name })}
            onPress={() =>
              pickExercise({
                title: t('planEditor.percent.basisPicker'),
                onSelect: (id) => update(setBasis(percent, id === exercise.exerciseId ? undefined : id)),
              })
            }
          />
          {basisId !== undefined ? (
            <Button
              variant="secondary"
              label={t('planEditor.percent.basisReset')}
              accessibilityLabel={t('planEditor.percent.basisResetOf', { exercise: name })}
              onPress={() => update(setBasis(percent, undefined))}
            />
          ) : null}
        </View>
        {error('basisExerciseId') ? <ErrorText text={error('basisExerciseId')} /> : null}
      </View>

      {percent.weeks.length > 1 ? (
        <View style={styles.basis}>
          <Text variant="label">{t('planEditor.percent.startWeek')}</Text>
          <Stepper
            label={t('planEditor.percent.startWeekOf', { exercise: name })}
            value={percent.startWeek ?? 1}
            min={1}
            max={percent.weeks.length}
            onChange={(week) => update(setStartWeek(percent, week))}
          />
          {error('startWeek') ? <ErrorText text={error('startWeek')} /> : null}
        </View>
      ) : null}

      {error('weeks') ? <ErrorText text={error('weeks')} /> : null}

      {percent.weeks.map((week, weekIndex) => (
        <WeekEditor
          key={weekIndex}
          generation={generation}
          weekIndex={weekIndex}
          weekCount={percent.weeks.length}
          sets={week.sets}
          exerciseName={name}
          error={errors[`${path}.percent.weeks[${weekIndex}].sets`]}
          groupError={(groupIndex, field) =>
            errors[`${path}.percent.weeks[${weekIndex}].sets[${groupIndex}].${field}`]
          }
          onInvalid={(key, invalid) => onInvalid(`${weekIndex}:${key}`, invalid)}
          onCopyPrevious={() => update(copyPreviousWeek(percent, weekIndex), true)}
          onRemove={() => update(removeWeek(percent, weekIndex), true)}
          onAddGroup={() => update(addGroup(percent, weekIndex))}
          onRemoveGroup={(groupIndex) => update(removeGroup(percent, weekIndex, groupIndex), true)}
          onChangeGroup={(groupIndex, patch) => update(updateGroup(percent, weekIndex, groupIndex, patch))}
        />
      ))}

      <Button
        variant="secondary"
        label={t('planEditor.percent.addWeek')}
        accessibilityLabel={t('planEditor.percent.addWeekTo', { exercise: name })}
        disabled={percent.weeks.length >= SCHEME_LIMITS.weeks.max}
        onPress={() => update(addWeek(percent))}
      />
    </View>
  );
}

function ErrorText({ text }: { text: string }) {
  return (
    <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
      {text}
    </Text>
  );
}

type WeekEditorProps = {
  generation: number;
  weekIndex: number;
  weekCount: number;
  sets: readonly SchemeSet[];
  exerciseName: string;
  error: string | undefined;
  groupError: (groupIndex: number, field: string) => string | undefined;
  onInvalid: (key: string, invalid: boolean) => void;
  onCopyPrevious: () => void;
  onRemove: () => void;
  onAddGroup: () => void;
  onRemoveGroup: (groupIndex: number) => void;
  onChangeGroup: (groupIndex: number, patch: Partial<SchemeSet>) => void;
};

function WeekEditor({
  generation,
  weekIndex,
  weekCount,
  sets,
  exerciseName: name,
  error,
  groupError,
  onInvalid,
  onCopyPrevious,
  onRemove,
  onAddGroup,
  onRemoveGroup,
  onChangeGroup,
}: WeekEditorProps) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const week = weekIndex + 1;
  return (
    <View
      testID={`percent-week-${week}`}
      accessibilityLabel={t('planEditor.percent.week', { week })}
      style={[styles.week, { borderColor: colors.border }]}>
      <View style={styles.weekHeader}>
        <Text variant="label" accessibilityRole="header">
          {t('planEditor.percent.week', { week })}
        </Text>
        <View style={styles.row}>
          {weekIndex > 0 ? (
            <Button
              variant="secondary"
              label={t('planEditor.percent.copyPrevious')}
              accessibilityLabel={t('planEditor.percent.copyPreviousOf', { previous: week - 1, week, exercise: name })}
              onPress={onCopyPrevious}
            />
          ) : null}
          {weekCount > SCHEME_LIMITS.weeks.min ? (
            <Button
              variant="secondary"
              label={t('planEditor.percent.removeWeek')}
              accessibilityLabel={t('planEditor.percent.removeWeekOf', { week, exercise: name })}
              onPress={onRemove}
            />
          ) : null}
        </View>
      </View>
      {sets.length === 0 ? <Text tone="secondary">{t('planEditor.percent.notTrained')}</Text> : null}
      {error ? <ErrorText text={error} /> : null}
      {sets.map((set, groupIndex) => (
        <GroupEditor
          key={`${generation}:${groupIndex}`}
          set={set}
          exerciseName={name}
          week={week}
          group={groupIndex + 1}
          error={(field) => groupError(groupIndex, field)}
          onInvalid={(key, invalid) => onInvalid(`${groupIndex}:${key}`, invalid)}
          onChange={(patch) => onChangeGroup(groupIndex, patch)}
          onRemove={() => onRemoveGroup(groupIndex)}
        />
      ))}
      <Button
        variant="secondary"
        label={t('planEditor.percent.addGroup')}
        accessibilityLabel={t('planEditor.percent.addGroupOf', { week, exercise: name })}
        disabled={sets.length >= SCHEME_LIMITS.groupsPerWeek.max}
        onPress={onAddGroup}
      />
    </View>
  );
}

type GroupEditorProps = {
  set: SchemeSet;
  exerciseName: string;
  week: number;
  group: number;
  error: (field: string) => string | undefined;
  onInvalid: (key: string, invalid: boolean) => void;
  onChange: (patch: Partial<SchemeSet>) => void;
  onRemove: () => void;
};

function GroupEditor({ set, exerciseName: name, week, group, error, onInvalid, onChange, onRemove }: GroupEditorProps) {
  const { t } = useI18n();
  const field = (caption: string) => t('planEditor.percent.field', { exercise: name, week, group, field: caption });
  const errors = ['repeat', 'reps', 'percent', 'addKg'].map(error).filter((e): e is string => e !== undefined);
  return (
    <View style={styles.group} testID={`percent-group-${week}-${group}`}>
      <View style={styles.row}>
        <Text variant="label">{t('planEditor.percent.group', { group })}</Text>
        <Button
          variant="secondary"
          label={t('planEditor.percent.removeGroup')}
          accessibilityLabel={t('planEditor.percent.removeGroupOf', { group, week, exercise: name })}
          onPress={onRemove}
        />
      </View>
      <View style={styles.fields}>
        <View style={styles.field}>
          <Text variant="caption">{t('planEditor.percent.sets')}</Text>
          <Stepper
            label={field(t('planEditor.percent.sets'))}
            value={set.repeat ?? 1}
            min={SCHEME_LIMITS.repeat.min}
            max={SCHEME_LIMITS.repeat.max}
            onChange={(repeat) => onChange({ repeat })}
          />
        </View>
        <View style={styles.field}>
          <Text variant="caption">{t('planEditor.percent.reps')}</Text>
          <Stepper
            label={field(t('planEditor.percent.reps'))}
            value={set.reps}
            min={SCHEME_LIMITS.reps.min}
            max={SCHEME_LIMITS.reps.max}
            onChange={(reps) => onChange({ reps })}
          />
        </View>
        <View style={styles.numberField}>
          <Text variant="caption">{t('planEditor.percent.percentLabel')}</Text>
          <TrackedNumber
            label={field(t('planEditor.percent.percentLabel'))}
            value={set.percent ?? null}
            rules={PERCENT_RULES}
            invalidKey="percent"
            onInvalid={onInvalid}
            onValue={(percent) => onChange({ percent: percent ?? undefined })}
          />
        </View>
        <View style={styles.numberField}>
          <Text variant="caption">{t('planEditor.percent.addKg')}</Text>
          <TrackedNumber
            label={field(t('planEditor.percent.addKg'))}
            value={set.addKg ?? null}
            rules={ADD_KG_RULES}
            invalidKey="addKg"
            onInvalid={onInvalid}
            onValue={(addKg) => onChange({ addKg: addKg ?? undefined })}
          />
        </View>
        <ToggleChip
          label={t('planEditor.percent.amrap')}
          accessibilityLabel={field(t('planEditor.percent.amrap'))}
          checked={set.amrap === true}
          onChange={(amrap) => onChange({ amrap })}
        />
      </View>
      {errors.map((message) => (
        <ErrorText key={message} text={message} />
      ))}
    </View>
  );
}

type TrackedNumberProps = {
  label: string;
  value: number | null;
  rules: Parameters<typeof NumberInput>[0]['rules'];
  invalidKey: string;
  onInvalid: (key: string, invalid: boolean) => void;
  onValue: (value: number | null) => void;
};

/**
 * A compact number field. Invalid text keeps the previous value and is reported through
 * `onInvalid`; the flag is cleared when the field goes away.
 */
export function TrackedNumber({ label, value, rules, invalidKey, onInvalid, onValue }: TrackedNumberProps) {
  const onInvalidRef = useRef(onInvalid);
  useEffect(() => {
    onInvalidRef.current = onInvalid;
  });
  useEffect(() => () => onInvalidRef.current(invalidKey, false), [invalidKey]);
  return (
    <NumberInput
      compact
      label={label}
      value={value}
      rules={rules}
      onChange={({ value: next, error }: NumberInputChange) => {
        onInvalid(invalidKey, error !== null);
        if (error === null) onValue(next);
      }}
    />
  );
}

type ToggleChipProps = {
  label: string;
  accessibilityLabel: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

/** An on/off pill (`switch` role) with a ≥ 44 pt touch target. */
export function ToggleChip({ label, accessibilityLabel, checked, onChange }: ToggleChipProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={[
        styles.toggle,
        {
          backgroundColor: checked ? colors.accent : colors.surface,
          borderColor: checked ? colors.accent : colors.border,
        },
      ]}>
      <Text variant="label" style={{ color: checked ? colors.onAccent : colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  basis: { gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  week: { borderLeftWidth: 3, paddingLeft: spacing.sm, gap: spacing.sm },
  weekHeader: { gap: spacing.xs },
  group: { gap: spacing.xs, paddingVertical: spacing.xs },
  fields: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: spacing.md },
  field: { gap: spacing.xs },
  numberField: { gap: spacing.xs, width: 96 },
  toggle: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
