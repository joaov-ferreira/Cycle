import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, spacing } from '@/constants/theme';
import type { Exercise } from '@/domain/exercise';
import { workoutSummary, type Workout } from '@/domain/workout';
import { useI18n } from '@/i18n';
import {
  selectAllExercises,
  selectFindExercise,
  selectHistory,
  useAppStore,
  type HistoryFilter,
} from '@/state';

import { Chip, EmptyState, ExerciseSelectModal, FilterChips, useExerciseName } from '../shared';
import { useTheme } from '../theme-provider';
import { Button, Card, Text } from '../ui';
import { WorkoutBadge } from './workout-badge';

export type HistoryScreenProps = {
  onOpenWorkout: (id: number) => void;
  onBack?: () => void;
};

/** History list (SPEC §8): completed workouts, newest first, filtered by plan and/or exercise. */
export function HistoryScreen({ onOpenWorkout, onBack }: HistoryScreenProps) {
  const { t, formatDate, formatKg } = useI18n();
  const { colors } = useTheme();
  const nameOf = useExerciseName();

  const allWorkouts = useAppStore((s) => s.workouts);
  const plans = useAppStore((s) => s.plans);
  const exercises = useAppStore(selectAllExercises);
  const findExercise = useAppStore(selectFindExercise);

  const [planFilter, setPlanFilter] = useState<string | null>(null);
  const [exerciseFilter, setExerciseFilter] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const filter: HistoryFilter = {
    planId: planFilter === null ? undefined : Number(planFilter),
    exerciseId: exerciseFilter ?? undefined,
  };
  const workouts = useAppStore((s) => selectHistory(s, filter));

  const planOptions = useMemo(() => {
    const used = new Set(allWorkouts.map((w) => w.planId));
    return plans
      .filter((p) => used.has(p.id))
      .map((p) => ({ value: String(p.id), label: p.name }));
  }, [allWorkouts, plans]);

  const trainedExercises = useMemo(() => {
    const ids = new Set(allWorkouts.flatMap((w) => w.exercises.map((e) => e.exerciseId)));
    return exercises.filter((e: Exercise) => ids.has(e.id));
  }, [allWorkouts, exercises]);

  const planNameById = useMemo(() => new Map(plans.map((p) => [p.id, p.name])), [plans]);

  const filtering = planFilter !== null || exerciseFilter !== null;
  const clearFilters = () => {
    setPlanFilter(null);
    setExerciseFilter(null);
  };
  const selectedExercise = exerciseFilter === null ? undefined : findExercise(exerciseFilter);

  const header = (
    <View style={styles.header}>
      <Text variant="title">{t('history.title')}</Text>
      {onBack ? <Button variant="secondary" label={t('common.back')} onPress={onBack} /> : null}
      {allWorkouts.length > 0 ? (
        <View style={styles.filters}>
          {planOptions.length > 0 ? (
            <FilterChips
              options={planOptions}
              value={planFilter}
              onChange={setPlanFilter}
              allLabel={t('common.all')}
              testID="history-plan-filter"
            />
          ) : null}
          <View style={styles.exerciseFilter}>
            <Button
              variant="secondary"
              label={t('history.filterExercise')}
              onPress={() => setPicking(true)}
            />
            {exerciseFilter !== null ? (
              <Chip
                selected
                label={t('history.exerciseFilterChip', {
                  name: selectedExercise ? nameOf(selectedExercise) : exerciseFilter,
                })}
                onPress={() => setExerciseFilter(null)}
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );

  const renderItem = ({ item }: { item: Workout }) => {
    const summary = workoutSummary(item);
    const planName = item.planId === null ? null : planNameById.get(item.planId);
    const date = formatDate(new Date(item.completedAt ?? item.startedAt));
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('history.openWorkout', { name: item.name, date })}
        onPress={() => onOpenWorkout(item.id)}
        testID={`history-row-${item.id}`}
        style={styles.rowPressable}>
        <Card>
          <View style={styles.rowTop}>
            <Text variant="caption" tone="secondary">
              {date}
            </Text>
            {item.phase === 'deload' ? <WorkoutBadge label={t('history.deload')} /> : null}
          </View>
          <Text variant="heading">{item.name}</Text>
          {item.planId === null && item.planWorkoutId === null ? (
            <Text tone="secondary">{t('history.freeWorkout')}</Text>
          ) : planName ? (
            <Text tone="secondary">{planName}</Text>
          ) : null}
          <View style={styles.rowTotals}>
            <Text tabular>{t('history.workingSets', { count: summary.workingSets })}</Text>
            <Text tabular>{t('history.volume', { volume: formatKg(summary.volumeKg, { minimumFractionDigits: 0 }) })}</Text>
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.root, { backgroundColor: colors.background }]}
      testID="screen-history">
      <FlatList
        data={workouts}
        keyExtractor={(w) => String(w.id)}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={
          allWorkouts.length === 0 ? (
            <EmptyState
              title={t('history.emptyTitle')}
              message={t('history.emptyMessage')}
              testID="history-empty"
            />
          ) : (
            <EmptyState
              title={t('history.noMatchTitle')}
              message={t('history.noMatchMessage')}
              actionLabel={filtering ? t('history.clearFilters') : undefined}
              onAction={clearFilters}
              testID="history-no-match"
            />
          )
        }
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Separator}
      />
      <ExerciseSelectModal
        visible={picking}
        title={t('history.filterExercise')}
        exercises={trainedExercises}
        onSelect={(exercise) => {
          setExerciseFilter(exercise.id);
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </SafeAreaView>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    padding: spacing.lg,
  },
  header: { gap: spacing.md, marginBottom: spacing.lg },
  filters: { gap: spacing.sm },
  exerciseFilter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  rowPressable: { minHeight: layout.minTouchTarget },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  rowTotals: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  separator: { height: spacing.md },
});
