import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, spacing } from '@/constants/theme';
import { schemeSummary } from '@/domain/percent-scheme';
import { PLAN_LIMITS, type PlanExercise } from '@/domain/plan';
import { useI18n } from '@/i18n';

import { Stepper } from '../../shared';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { NumberInput } from '../../ui/NumberInput';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { coupleRepMax, coupleRepMin } from './draft-ops';
import { IconButton } from './icon-button';
import { PercentEditor } from './percent-editor';
import { toAutomatic, toPercent } from './percent-ops';
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
  /** Reports whether a number field of the row (start load, scheme percent, ...) holds invalid text. */
  onLoadInvalid: (invalid: boolean) => void;
  /** Starts with the targets open (an exercise that was just added). */
  startExpanded?: boolean;
  /**
   * Called when the row opens or closes. The parent remembers it so that the row keeps its state
   * when it is remounted under another parent (linking or unlinking a superset).
   */
  onExpandedChange?: (expanded: boolean) => void;
  /** "Link with next"; omitted for the last exercise and for one already linked to the next. */
  link?: { disabled: boolean; onLink: () => void };
  /** "Unlink"; present on a superset member other than the first. */
  onUnlink?: () => void;
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
  onExpandedChange,
  link,
  onUnlink,
}: ExerciseRowProps) {
  const { t, formatNumber } = useI18n();
  // Several number fields can hold invalid text at once: the row reports "invalid" while any does.
  const invalidKeys = useRef(new Set<string>());
  const onLoadInvalidRef = useRef(onLoadInvalid);
  useEffect(() => {
    onLoadInvalidRef.current = onLoadInvalid;
  });
  const reportInvalid = useCallback((key: string, invalid: boolean) => {
    const keys = invalidKeys.current;
    if (keys.has(key) === invalid) return;
    if (invalid) keys.add(key);
    else keys.delete(key);
    onLoadInvalidRef.current(keys.size > 0);
  }, []);
  const hasIssue = Object.keys(errors).some((key) => key === path || key.startsWith(`${path}.`));
  const [expanded, setExpandedState] = useState(startExpanded || hasIssue);
  const setExpanded = (next: boolean) => {
    setExpandedState(next);
    onExpandedChange?.(next);
  };

  const error = (field: string) => errors[`${path}.${field}`] ?? null;
  // An issue that appears opens the row (and keeps it open once it is fixed): adjusting state
  // while rendering, as React recommends for state derived from props.
  const [sawIssue, setSawIssue] = useState(hasIssue);
  if (hasIssue !== sawIssue) {
    setSawIssue(hasIssue);
    if (hasIssue) setExpandedState(true);
  }
  const repsError = error('repMin') ?? error('repMax');
  const { percent } = exercise;
  const scheme = percent ? schemeSummary(percent) : null;
  const summary = [
    percent && !scheme
      ? t('planEditor.percent.noSets')
      : t('planEditor.summary', {
          sets: formatNumber(scheme?.sets ?? exercise.sets),
          min: formatNumber(scheme?.repMin ?? exercise.repMin),
          max: formatNumber(scheme?.repMax ?? exercise.repMax),
        }),
    percent ? t('planEditor.percent.rowTag') : null,
    percent ? t('planEditor.percent.weeksCount', { count: percent.weeks.length }) : null,
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
          onPress={() => setExpanded(!expanded)}
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
      {link || onUnlink ? (
        <View style={styles.linkRow}>
          {onUnlink ? (
            <Button
              variant="secondary"
              label={t('planEditor.unlink')}
              accessibilityLabel={t('planEditor.unlinkOf', { exercise: name })}
              onPress={onUnlink}
            />
          ) : null}
          {link ? (
            <Button
              variant="secondary"
              label={t('planEditor.linkNext')}
              accessibilityLabel={t('planEditor.linkNextOf', { exercise: name })}
              hint={link.disabled ? t('planEditor.linkLimit') : undefined}
              disabled={link.disabled}
              onPress={link.onLink}
            />
          ) : null}
        </View>
      ) : null}
      {error('exerciseId') ? (
        <Text variant="caption" tone="danger">
          {error('exerciseId')}
        </Text>
      ) : null}

      {expanded ? (
        <>
          <View style={styles.progression}>
            <Text variant="label">{t('planEditor.progression.label')}</Text>
            <SegmentedControl
              label={t('planEditor.progression.of', { exercise: name })}
              value={percent ? 'percent' : 'auto'}
              options={[
                { value: 'auto', label: t('planEditor.progression.auto') },
                { value: 'percent', label: t('planEditor.progression.percent') },
              ]}
              onChange={(mode) => onChange(mode === 'percent' ? toPercent(exercise) : toAutomatic(exercise))}
            />
          </View>
          {percent ? (
            <PercentEditor
              exercise={{ ...exercise, percent }}
              name={name}
              path={path}
              errors={errors}
              onChange={onChange}
              onInvalid={reportInvalid}
            />
          ) : (
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
            </>
          )}
          <View style={styles.options}>
            {percent ? null : (
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
            )}
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
            {percent ? null : (
              <LoadField
                label={label.load}
                value={exercise.startLoadKg}
                onInvalid={(invalid) => reportInvalid('load', invalid)}
                onChange={(startLoadKg) =>
                  onChange(startLoadKg === undefined ? without(exercise, 'startLoadKg') : { ...exercise, startLoadKg })
                }
                error={error('startLoadKg')}
              />
            )}
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
  progression: { gap: spacing.xs },
  title: { flex: 1, gap: spacing.xs, minHeight: layout.minTouchTarget, justifyContent: 'center' },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  targets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  target: { gap: spacing.xs },
  options: { gap: spacing.md },
  load: { gap: spacing.xs },
});
