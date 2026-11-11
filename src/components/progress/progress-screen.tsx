import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { spacing } from '@/constants/theme';
import { Chip } from '@/components/shared/chip';
import { useExerciseName } from '@/components/shared/labels';
import { EmptyState } from '@/components/shared/empty-state';
import { allowsZeroLoad } from '@/domain/exercise';
import { metricsFor, type Metric } from '@/domain/stats';
import { PERIODS, type Period } from '@/domain/period';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';
import { selectFindExercise, selectSeries, selectTrainedExerciseIds } from '@/state/selectors';

import { Button, Screen, SegmentedControl } from '../ui';
import { LineChart } from './line-chart';
import { PersonalRecordsCard } from './personal-records-card';
import { WeeklyVolumeCard } from './weekly-volume-card';

export type ProgressScreenProps = {
  /** Exercise selected first, when it has been trained. */
  initialExerciseId?: string;
  /** The reference time (defaults to the current time when the screen mounts). */
  now?: Date;
  onOpenExercise?: (exerciseId: string) => void;
  onOpenWorkout?: (workoutId: number) => void;
};

const NBSP = ' ';

/** Progress (SPEC §9): an exercise's chart, its records and the weekly sets per muscle group. */
export function ProgressScreen({ initialExerciseId, now, onOpenExercise, onOpenWorkout }: ProgressScreenProps) {
  const { t, formatKg, formatNumber } = useI18n();
  const nameOf = useExerciseName();
  const findExercise = useAppStore(selectFindExercise);
  const trained = useAppStore(selectTrainedExerciseIds);
  const clock = useMemo(() => now ?? new Date(), [now]);

  const [chosenExerciseId, setChosenExerciseId] = useState<string | undefined>(initialExerciseId);
  const [chosenPeriod, setChosenPeriod] = useState<Period>('all');
  const [chosenMetric, setChosenMetric] = useState<Metric | undefined>(undefined);

  const selectedId =
    chosenExerciseId !== undefined && trained.includes(chosenExerciseId) ? chosenExerciseId : (trained[0] ?? null);
  const exercise = selectedId === null ? undefined : findExercise(selectedId);
  const metrics = metricsFor(exercise?.equipment ?? 'other');
  const metric = chosenMetric !== undefined && metrics.includes(chosenMetric) ? chosenMetric : metrics[0];
  const series = useAppStore((state) =>
    selectedId === null ? null : selectSeries(state, selectedId, metric, chosenPeriod, clock),
  );
  const entries = useMemo(
    () => (series ?? []).map((point) => ({ id: point.workoutId, at: point.at, value: point.value })),
    [series],
  );

  return (
    <Screen title={t('progress.title')} testID="screen-progress">
      {selectedId === null || !exercise ? (
        <EmptyState title={t('progress.empty.title')} testID="progress-empty" />
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            accessibilityLabel={t('progress.exerciseGroup')}
            contentContainerStyle={styles.chips}>
            {trained.map((exerciseId) => {
              const item = findExercise(exerciseId);
              const label = item ? nameOf(item) : exerciseId;
              return (
                <Chip
                  key={exerciseId}
                  label={label}
                  selected={exerciseId === selectedId}
                  onPress={() => setChosenExerciseId(exerciseId)}
                />
              );
            })}
          </ScrollView>

          <SegmentedControl
            label={t('progress.periodGroup')}
            options={PERIODS.map((period) => ({ value: period, label: t(`progress.periods.${period}`) }))}
            value={chosenPeriod}
            onChange={setChosenPeriod}
          />

          <SegmentedControl
            label={t('progress.metricGroup')}
            options={metrics.map((option) => ({ value: option, label: t(`progress.metrics.${option}`) }))}
            value={metric}
            onChange={setChosenMetric}
          />

          <LineChart
            label={nameOf(exercise)}
            seriesLabel={t(metric === 'e1rm' ? 'progress.metrics.e1rmEstimate' : `progress.metrics.${metric}`)}
            series={entries}
            period={chosenPeriod}
            now={clock}
            unit={metric === 'reps' ? t('progress.units.reps') : t('common.kg')}
            formatValue={
              metric === 'reps'
                ? (value) => `${formatNumber(value, { maximumFractionDigits: 1 })}${NBSP}${t('progress.units.reps')}`
                : (value) => formatKg(value, { minimumFractionDigits: 0, maximumFractionDigits: 1 })
            }
          />

          <Button
            variant="secondary"
            label={t('progress.details')}
            onPress={() => onOpenExercise?.(selectedId)}
          />

          <PersonalRecordsCard
            exerciseId={selectedId}
            zeroLoad={allowsZeroLoad(exercise.equipment)}
            onOpenWorkout={onOpenWorkout}
          />

          <WeeklyVolumeCard now={clock} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
});
