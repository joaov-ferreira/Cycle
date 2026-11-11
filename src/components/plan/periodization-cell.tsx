import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { weekTargetRir } from '@/domain/cycle';
import type { Plan } from '@/domain/plan';
import type { PeriodizationWeek, PeriodizationWorkout } from '@/state';
import { selectEffortScale, selectFindExercise, useAppStore } from '@/state';
import { useI18n } from '@/i18n';

import { exerciseName } from '../shared';
import { Text } from '../ui';
import { effortText, localText, prescriptionLines, targetText } from './prescription-text';

export type PeriodizationCellProps = {
  plan: Plan;
  week: PeriodizationWeek;
  workout: PeriodizationWorkout;
};

/**
 * What one workout trains in one week of the cycle: percent exercises as groups
 * (`6×6 @70 % → 70 kg`), automatic ones as `3 × 8–12 · RIR 2`, a rest day labeled.
 */
export function PeriodizationCell({ plan, week, workout }: PeriodizationCellProps) {
  const i18n = useI18n();
  const { t, locale } = i18n;
  const find = useAppStore(selectFindExercise);
  const effortScale = useAppStore(selectEffortScale);
  const rampRir = weekTargetRir(plan.cycle, { ...plan.cycleState, phase: week.phase, week: week.cycleWeek });

  if (workout.isRestDay) {
    return (
      <View style={styles.cell}>
        <Text tone="secondary">{t('plan.rx.restDay')}</Text>
        {workout.notes.map((note) => (
          <Text key={note.en} tone="secondary" variant="caption">
            {localText(note, locale)}
          </Text>
        ))}
      </View>
    );
  }
  return (
    <View style={styles.cell}>
      {workout.exercises.map(({ effective, prescription }) => {
        const found = find(effective.exerciseId);
        const name = effective.generated?.label
          ? localText(effective.generated.label, locale)
          : found
            ? exerciseName(found, locale)
            : effective.exerciseId;
        const rir = rampRir ?? effective.targetRir;
        return (
          <View key={effective.id} style={styles.exercise}>
            <Text variant="caption" tone="secondary">
              {name}
            </Text>
            {prescription ? (
              prescriptionLines(i18n, prescription, { compact: true }).map((line, i) => (
                <Text key={`${i}:${line}`} variant="label" tabular>
                  {line}
                </Text>
              ))
            ) : effective.generated?.kind === 'free' ? (
              <Text variant="label">{t('plan.table.emptyCell')}</Text>
            ) : (
              <Text variant="label" tabular>
                {[
                  targetText(i18n, effective.sets, effective.repMin, effective.repMax),
                  rir === undefined ? null : effortText(i18n, rir, effortScale),
                ]
                  .filter((part) => part !== null)
                  .join(' · ')}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { gap: spacing.sm },
  exercise: { gap: spacing.xs / 2 },
});
