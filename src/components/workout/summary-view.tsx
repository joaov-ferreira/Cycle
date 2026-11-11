import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import type { FinishResult } from '@/state';
import { selectFindExercise, useAppStore } from '@/state';
import { useI18n, type TFunction } from '@/i18n';

import { useExerciseName } from '../shared';
import { Button, Card, Screen, Text } from '../ui';

export type WorkoutSummaryProps = {
  result: FinishResult;
  onOpenWorkoutDetail: (id: number) => void;
};

/** `1 h 05 min` / `45 min` from whole seconds (rounded down to the minute). */
export function formatDuration(t: TFunction, seconds: number | null): string {
  const totalMinutes = Math.max(0, Math.floor((seconds ?? 0) / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return t('workout.durationMinutes', { minutes });
  return t('workout.durationHoursMinutes', { hours, minutes: String(minutes).padStart(2, '0') });
}

/** Shown after finishing (SPEC §7.4): duration, counts, volume and the personal records set. */
export function WorkoutSummary({ result, onOpenWorkoutDetail }: WorkoutSummaryProps) {
  const { t, formatKg, formatNumber } = useI18n();
  const exerciseLabel = useExerciseName();
  const findExercise = useAppStore(selectFindExercise);
  const clearLastFinish = useAppStore((s) => s.clearLastFinish);
  const { workout, summary, records } = result;
  const kg = (value: number) => formatKg(value, { minimumFractionDigits: 0 });

  const stats: [key: string, label: string, value: string][] = [
    ['duration', t('workout.duration'), formatDuration(t, summary.durationSeconds)],
    ['exercises', t('workout.exercises'), formatNumber(summary.exerciseCount)],
    ['sets', t('workout.workingSets'), formatNumber(summary.workingSets)],
    ['volume', t('workout.volume'), kg(summary.volumeKg)],
  ];

  return (
    <Screen title={t('workout.summaryTitle')} testID="screen-workout">
      <Text variant="heading">{workout.name}</Text>
      <Card>
        {stats.map(([key, label, value]) => (
          <View key={key} testID={`summary-${key}`} style={styles.stat}>
            <Text tone="secondary">{label}</Text>
            <Text variant="label" tabular>
              {value}
            </Text>
          </View>
        ))}
      </Card>

      {records.length > 0 ? (
        <Card testID="summary-records">
          <Text variant="heading">{t('workout.records')}</Text>
          {records.map((record) => {
            const exercise = findExercise(record.exerciseId);
            return (
              <View key={`${record.exerciseId}-${record.kind}`} style={styles.record}>
                <Text variant="label">{exercise ? exerciseLabel(exercise) : record.exerciseId}</Text>
                <Text tone="accent">
                  {t(record.kind === 'weight' ? 'workout.recordWeight' : 'workout.recordE1rm')}
                </Text>
                <Text tabular>
                  {t('workout.recordValue', { value: kg(record.valueKg), previous: kg(record.previousKg) })}
                </Text>
              </View>
            );
          })}
        </Card>
      ) : null}

      <Button label={t('workout.done')} onPress={clearLastFinish} />
      <Button
        variant="secondary"
        label={t('workout.viewInHistory')}
        onPress={() => {
          clearLastFinish();
          onOpenWorkoutDetail(workout.id);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stat: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  record: { gap: 2, paddingVertical: spacing.xs },
});
