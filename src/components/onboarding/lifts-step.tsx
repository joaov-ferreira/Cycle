import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import type { NumberRules } from '@/domain/number-validation';
import { REFERENCE_MAX_LIMITS, validateMaxKg } from '@/domain/reference-max';
import { useI18n } from '@/i18n';
import { selectAllExercises } from '@/state';
import { useAppStore } from '@/state/app-store-context';

import { EstimateFromSet } from '../maxes/estimate-from-set';
import { ExerciseSelectModal, exerciseName } from '../shared';
import { Button, Card, NumberInput, Text } from '../ui';

/** The suggested lifts of the strength path (SPEC-v4 §10.1): library ids of the three classic lifts. */
export const SUGGESTED_LIFT_IDS = ['barbell-back-squat', 'barbell-bench-press', 'conventional-deadlift'] as const;

/** One row of "Your lifts": the exercise and the 1RM typed so far (`null` while empty or invalid). */
export type LiftRow = { exerciseId: string; kg: number | null; estimating: boolean };

export const initialLifts = (): LiftRow[] =>
  SUGGESTED_LIFT_IDS.map((exerciseId) => ({ exerciseId, kg: null, estimating: false }));

/** The rows that have a valid 1RM: the only ones saved. */
export function filledLifts(rows: readonly LiftRow[]): { exerciseId: string; kg: number }[] {
  return rows
    .filter((row) => row.kg !== null && validateMaxKg(row.kg) === null)
    .map((row) => ({ exerciseId: row.exerciseId, kg: row.kg as number }));
}

const KG_RULES: NumberRules = {
  min: 0,
  minExclusive: true,
  max: REFERENCE_MAX_LIMITS.max,
  maxDecimals: 2,
};

export type LiftsStepProps = {
  rows: readonly LiftRow[];
  onChange: (rows: LiftRow[]) => void;
};

/**
 * "Your lifts": a row per exercise with a 1RM field or "Estimate from a set"; rows can be
 * removed, any library exercise can be added, and rows may stay empty.
 */
export function LiftsStep({ rows, onChange }: LiftsStepProps) {
  const { t, locale } = useI18n();
  const exercises = useAppStore(selectAllExercises);
  const [picking, setPicking] = useState(false);
  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const pickable = useMemo(() => exercises.filter((e) => !e.archived), [exercises]);

  const update = (exerciseId: string, patch: Partial<LiftRow>) =>
    onChange(rows.map((row) => (row.exerciseId === exerciseId ? { ...row, ...patch } : row)));

  return (
    <Card>
      <Text variant="heading">{t('onboarding.lifts.title')}</Text>
      <Text tone="secondary">{t('onboarding.lifts.intro')}</Text>
      {rows.map((row) => {
        const exercise = byId.get(row.exerciseId);
        const name = exercise ? exerciseName(exercise, locale) : row.exerciseId;
        const toggleLabel = row.estimating ? t('maxes.estimate.hide') : t('maxes.estimate.toggle');
        return (
          <View key={row.exerciseId} style={styles.row} testID={`lift-row-${row.exerciseId}`}>
            <View style={styles.rowHeader}>
              <Text variant="label" style={styles.name}>
                {name}
              </Text>
              <Button
                variant="secondary"
                label={t('common.remove')}
                accessibilityLabel={t('onboarding.lifts.remove', { exercise: name })}
                onPress={() => onChange(rows.filter((r) => r.exerciseId !== row.exerciseId))}
              />
            </View>
            <NumberInput
              label={t('onboarding.lifts.kgLabel', { exercise: name })}
              unit="kg"
              value={row.kg}
              rules={KG_RULES}
              onChange={({ value }) => update(row.exerciseId, { kg: value })}
            />
            <Button
              variant="secondary"
              label={toggleLabel}
              accessibilityLabel={t('onboarding.lifts.rowAction', { action: toggleLabel, exercise: name })}
              onPress={() => update(row.exerciseId, { estimating: !row.estimating })}
            />
            {row.estimating ? (
              <EstimateFromSet onUse={(kg) => update(row.exerciseId, { kg })} testIDPrefix={`lift-${row.exerciseId}`} />
            ) : null}
          </View>
        );
      })}
      <Button variant="secondary" label={t('onboarding.lifts.add')} onPress={() => setPicking(true)} />
      <ExerciseSelectModal
        visible={picking}
        title={t('onboarding.lifts.pickerTitle')}
        exercises={pickable}
        excludeIds={rows.map((row) => row.exerciseId)}
        onSelect={(exercise) => {
          setPicking(false);
          onChange([...rows, { exerciseId: exercise.id, kg: null, estimating: false }]);
        }}
        onClose={() => setPicking(false)}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  name: { flex: 1 },
});
