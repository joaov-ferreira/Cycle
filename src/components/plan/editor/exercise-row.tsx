import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, spacing } from '@/constants/theme';
import { PLAN_LIMITS, type PlanExercise } from '@/domain/plan';
import { useI18n } from '@/i18n';

import { Stepper } from '../../shared';
import { Card } from '../../ui/Card';
import { NumberInput } from '../../ui/NumberInput';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { coupleRepMax, coupleRepMin } from './draft-ops';
import { IconButton } from './icon-button';
import { OptionalStepper } from './optional-stepper';

const LOAD_RULES = {
  min: PLAN_LIMITS.startLoadKg.min,
  max: PLAN_LIMITS.startLoadKg.max,
  maxDecimals: PLAN_LIMITS.startLoadKg.maxDecimals,
};
const REST_STEP = 15;

export type ExerciseRowProps = {
  exercise: PlanExercise;
  /** The exercise's name in the UI language. */
  name: string;
  /** Raw issue path of this exercise, e.g. `workouts[0].exercises[1]`. */
  path: string;
  /** Localized issue messages by raw issue path. */
  errors: Record<string, string>;
  isFirst: boolean;
  isLast: boolean;
  onChange: (next: PlanExercise) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  /** Reports whether the start-load field currently holds text that is not a valid number. */
  onLoadInvalid: (invalid: boolean) => void;
  /** Starts with the targets open (an exercise that was just added). */
  startExpanded?: boolean;
};

/** Removes `key` from an exercise instead of leaving an `undefined` behind. */
function without(exercise: PlanExercise, key: 'targetRir' | 'restSeconds' | 'startLoadKg' | 'note'): PlanExercise {
  const copy = { ...exercise };
  delete copy[key];
  return copy;
}

/**
 * One exercise of a workout. Collapsed (the default) it is one compact line: the name and the
 * summary `3 × 8–12 · RIR 2 · 90 s`, plus reorder and remove. Tapping the line expands the steppers
 * and the optional fields (RIR, rest, start load, note). A new exercise starts expanded, and an
 * exercise with a validation issue opens by itself.
 */
export function ExerciseRow({
  exercise,
  name,
  path,
  errors,
  isFirst,
  isLast,
  onChange,
  onMove,
  onRemove,
  onLoadInvalid,
  startExpanded = false,
}: ExerciseRowProps) {
  const { t, formatNumber } = useI18n();
  const [expanded, setExpanded] = useState(startExpanded);

  const error = (field: string) => errors[`${path}.${field}`] ?? null;
  const hasIssue = Object.keys(errors).some((key) => key === path || key.startsWith(`${path}.`));
  useEffect(() => {
    if (hasIssue) setExpanded(true);
  }, [hasIssue]);
  const repsError = error('repMin') ?? error('repMax');
  const summary = [
    t('planEditor.summary', {
      sets: formatNumber(exercise.sets),
      min: formatNumber(exercise.repMin),
      max: formatNumber(exercise.repMax),
    }),
    exercise.targetRir === undefined ? null : t('planEditor.rirSummary', { rir: formatNumber(exercise.targetRir) }),
    exercise.restSeconds === undefined ? null : t('planEditor.restValue', { value: formatNumber(exercise.restSeconds) }),
  ]
    .filter((part) => part !== null)
    .join(' · ');
  const label = {
    sets: t('planEditor.setsOf', { exercise: name }),
    repMin: t('planEditor.repMinOf', { exercise: name }),
    repMax: t('planEditor.repMaxOf', { exercise: name }),
    rir: t('planEditor.rirOf', { exercise: name }),
    rest: t('planEditor.restOf', { exercise: name }),
    load: t('planEditor.loadOf', { exercise: name }),
    note: t('planEditor.noteOf', { exercise: name }),
  };

  return (
    <Card>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('planEditor.editTargets', { exercise: name })}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((open) => !open)}
          style={styles.title}>
          <Text variant="label">{name}</Text>
          <Text tone="secondary" tabular>
            {summary}
          </Text>
        </Pressable>
        <IconButton
          glyph="↑"
          label={t('planEditor.moveUp', { name })}
          disabled={isFirst}
          onPress={() => onMove(-1)}
        />
        <IconButton
          glyph="↓"
          label={t('planEditor.moveDown', { name })}
          disabled={isLast}
          onPress={() => onMove(1)}
        />
        <IconButton glyph="✕" label={t('planEditor.removeExercise', { exercise: name })} onPress={onRemove} />
      </View>
      {error('exerciseId') ? (
        <Text variant="caption" tone="danger">
          {error('exerciseId')}
        </Text>
      ) : null}

      {expanded ? (
        <>
          <View style={styles.targets}>
            <View style={styles.target}>
              <Text variant="label">{t('common.sets')}</Text>
              <Stepper
                label={label.sets}
                value={exercise.sets}
                min={PLAN_LIMITS.sets.min}
                max={PLAN_LIMITS.sets.max}
                onChange={(sets) => onChange({ ...exercise, sets })}
              />
            </View>
            <View style={styles.target}>
              <Text variant="label">{t('planEditor.repMinLabel')}</Text>
              <Stepper
                label={label.repMin}
                value={exercise.repMin}
                min={PLAN_LIMITS.reps.min}
                max={PLAN_LIMITS.reps.max}
                onChange={(repMin) => onChange(coupleRepMin(exercise, repMin))}
              />
            </View>
            <View style={styles.target}>
              <Text variant="label">{t('planEditor.repMaxLabel')}</Text>
              <Stepper
                label={label.repMax}
                value={exercise.repMax}
                min={PLAN_LIMITS.reps.min}
                max={PLAN_LIMITS.reps.max}
                onChange={(repMax) => onChange(coupleRepMax(exercise, repMax))}
              />
            </View>
          </View>
          {error('sets') ? (
            <Text variant="caption" tone="danger">
              {error('sets')}
            </Text>
          ) : null}
          {repsError ? (
            <Text variant="caption" tone="danger">
              {repsError}
            </Text>
          ) : null}
          <View style={styles.options}>
              <OptionalStepper
                caption={t('planEditor.rirLabel')}
                label={label.rir}
                value={exercise.targetRir}
                min={PLAN_LIMITS.targetRir.min}
                max={PLAN_LIMITS.targetRir.max}
                initial={2}
                onChange={(targetRir) =>
                  onChange(targetRir === undefined ? without(exercise, 'targetRir') : { ...exercise, targetRir })
                }
                error={error('targetRir')}
              />
              <OptionalStepper
                caption={t('planEditor.restLabel')}
                label={label.rest}
                value={exercise.restSeconds}
                min={REST_STEP}
                max={PLAN_LIMITS.restSeconds.max}
                step={REST_STEP}
                initial={90}
                format={(seconds) => t('planEditor.restValue', { value: formatNumber(seconds) })}
                onChange={(restSeconds) =>
                  onChange(restSeconds === undefined ? without(exercise, 'restSeconds') : { ...exercise, restSeconds })
                }
                error={error('restSeconds')}
              />
              <LoadField
                label={label.load}
                value={exercise.startLoadKg}
                onInvalid={onLoadInvalid}
                onChange={(startLoadKg) =>
                  onChange(startLoadKg === undefined ? without(exercise, 'startLoadKg') : { ...exercise, startLoadKg })
                }
                error={error('startLoadKg')}
              />
              <TextField
                label={label.note}
                value={exercise.note ?? ''}
                onChangeText={(text) => onChange(text === '' ? without(exercise, 'note') : { ...exercise, note: text })}
                error={error('note')}
              />
            </View>
        </>
      ) : null}
    </Card>
  );
}

type LoadFieldProps = {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  onInvalid: (invalid: boolean) => void;
  error: string | null;
};

/** The start load in kg. Invalid text keeps the previous value and is reported through `onInvalid`. */
function LoadField({ label, value, onChange, onInvalid, error }: LoadFieldProps) {
  const { t } = useI18n();
  const onInvalidRef = useRef(onInvalid);
  useEffect(() => {
    onInvalidRef.current = onInvalid;
  });
  // The field's text disappears with the field, so it can no longer be invalid.
  useEffect(() => () => onInvalidRef.current(false), []);
  return (
    <View style={styles.load}>
      <NumberInput
        label={label}
        unit={t('common.kg')}
        value={value ?? null}
        rules={LOAD_RULES}
        onChange={({ value: next, error: invalid }) => {
          onInvalid(invalid !== null);
          if (invalid === null) onChange(next ?? undefined);
        }}
      />
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, gap: spacing.xs },
  targets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  target: { gap: spacing.xs },
  options: { gap: spacing.md },
  load: { gap: spacing.xs },
});
