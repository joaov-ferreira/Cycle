import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { selectPeriodization, useAppStore, type PeriodizationWeek } from '@/state';

import { Chip, EmptyState } from '../shared';
import { useTheme } from '../theme-provider';
import { Button, Card, Screen, Text } from '../ui';
import { PeriodizationCell } from './periodization-cell';

const PINNED_WIDTH = 132;
const WEEK_WIDTH = 220;
const HEADER_ROW = 'header';
const FOOTER_ROW = 'footer';

export type PeriodizationScreenProps = {
  planId: number;
  onBack: () => void;
};

/**
 * The periodization table (SPEC-v4 §10.4): the weeks of the plan's cycle × its workouts, with the
 * loads the logger will prescribe. Narrow screens show one week at a time; wide screens show every
 * week side by side, scrolling horizontally with the workout names pinned on the left.
 */
export function PeriodizationScreen({ planId, onBack }: PeriodizationScreenProps) {
  const { t } = useI18n();
  const plan = useAppStore((s) => s.plans.find((p) => p.id === planId));
  const table = useAppStore((s) => selectPeriodization(s, planId));
  const { width } = useWindowDimensions();
  const wide = width >= layout.wideBreakpoint;

  return (
    <Screen title={t('plan.table.title')} testID="screen-periodization">
      <Button variant="secondary" label={t('common.back')} onPress={onBack} />
      {plan ? <Text variant="heading">{plan.name}</Text> : null}
      {!plan ? (
        <EmptyState testID="periodization-not-found" title={t('plan.notFoundTitle')} message={t('plan.table.notFound')} />
      ) : plan.workouts.length === 0 ? (
        <Text tone="secondary">{t('plan.table.noWorkouts')}</Text>
      ) : wide ? (
        <WideTable planId={planId} weeks={table.weeks} />
      ) : (
        <WeekView planId={planId} weeks={table.weeks} />
      )}
    </Screen>
  );
}

function useWeekName() {
  const { t } = useI18n();
  return (week: PeriodizationWeek) =>
    week.phase === 'deload' ? t('plan.table.weekDeload', { week: week.cycleWeek }) : t('plan.table.weekLoad', { week: week.cycleWeek });
}

/** Tonnage and total reps of the percent work of one week. */
function WeekTotals({ week, testID }: { week: PeriodizationWeek; testID?: string }) {
  const { t, formatKg, formatNumber } = useI18n();
  return week.reps === 0 ? (
    <Text variant="caption" tone="secondary" testID={testID}>
      {t('plan.table.footerNone')}
    </Text>
  ) : (
    <Text variant="caption" tone="secondary" tabular testID={testID}>
      {[
        t('plan.table.tonnage', { kg: formatKg(week.tonnageKg, { minimumFractionDigits: 0 }) }),
        t('plan.table.totalReps', { reps: formatNumber(week.reps) }),
      ].join(' · ')}
    </Text>
  );
}

/** Narrow layout: a week selector (starting on the current week) and that week's workouts. */
function WeekView({ planId, weeks }: { planId: number; weeks: readonly PeriodizationWeek[] }) {
  const { t } = useI18n();
  const weekName = useWeekName();
  const plan = useAppStore((s) => s.plans.find((p) => p.id === planId));
  const [picked, setPicked] = useState<number | null>(null);
  const currentIndex = Math.max(0, weeks.findIndex((w) => w.isCurrent));
  const index = Math.min(picked ?? currentIndex, weeks.length - 1);
  const week = weeks[index];
  if (!plan || !week) return null;
  return (
    <View style={styles.stack}>
      <View accessibilityLabel={t('plan.table.weekSelector')} style={styles.stack}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {weeks.map((candidate, i) => (
            <Chip
              key={`${candidate.phase}-${candidate.cycleWeek}`}
              testID={`week-chip-${i + 1}`}
              label={
                candidate.isCurrent
                  ? t('plan.table.weekLabel', { name: weekName(candidate), state: t('plan.table.current') })
                  : weekName(candidate)
              }
              selected={i === index}
              onPress={() => setPicked(i)}
            />
          ))}
        </ScrollView>
      </View>
      <View testID="periodization-week" style={styles.stack}>
        {week.workouts.map((workout) => (
          <Card key={workout.workoutId} testID={`periodization-workout-${workout.workoutId}`}>
            <Text variant="heading">{workout.name}</Text>
            <PeriodizationCell plan={plan} week={week} workout={workout} />
          </Card>
        ))}
        <WeekTotals week={week} testID="periodization-footer" />
      </View>
    </View>
  );
}

/** Wide layout: weeks as columns, workouts as rows, the first column pinned. */
function WideTable({ planId, weeks }: { planId: number; weeks: readonly PeriodizationWeek[] }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const weekName = useWeekName();
  const plan = useAppStore((s) => s.plans.find((p) => p.id === planId));
  // The pinned column and the scrolling columns are separate views: rows stay aligned because every
  // cell of a row takes the height of the tallest one.
  const [heights, setHeights] = useState<Record<string, number>>({});
  const measure = (row: string) => (event: LayoutChangeEvent) => {
    const height = Math.ceil(event.nativeEvent.layout.height);
    setHeights((current) => (current[row] >= height ? current : { ...current, [row]: height }));
  };
  const rowStyle = (row: string) => ({ minHeight: heights[row] });
  if (!plan || weeks.length === 0) return null;
  const workouts = weeks[0].workouts;

  return (
    <View testID="periodization-table" style={styles.table}>
      <View style={{ width: PINNED_WIDTH }}>
        <View style={[styles.cell, rowStyle(HEADER_ROW)]} onLayout={measure(HEADER_ROW)}>
          <Text variant="label">{t('plan.table.workout')}</Text>
        </View>
        {workouts.map((workout) => (
          <View
            key={workout.workoutId}
            style={[styles.cell, styles.rowDivider, { borderColor: colors.border }, rowStyle(workout.workoutId)]}
            onLayout={measure(workout.workoutId)}>
            <Text variant="label">{workout.name}</Text>
          </View>
        ))}
        <View style={[styles.cell, styles.rowDivider, { borderColor: colors.border }, rowStyle(FOOTER_ROW)]} onLayout={measure(FOOTER_ROW)} />
      </View>
      <ScrollView horizontal testID="periodization-scroll">
        {weeks.map((week) => {
          const current = week.isCurrent;
          const background = current ? { backgroundColor: colors.surfaceRaised } : undefined;
          return (
            <View
              key={`${week.phase}-${week.cycleWeek}`}
              testID={`week-column-${week.phase}-${week.cycleWeek}`}
              style={[{ width: WEEK_WIDTH }, background]}>
              <View style={[styles.cell, rowStyle(HEADER_ROW)]} onLayout={measure(HEADER_ROW)}>
                <Text variant="label" tone={current ? 'accent' : 'primary'}>
                  {weekName(week)}
                </Text>
                {current ? (
                  <Text variant="caption" tone="accent">
                    {t('plan.table.current')}
                  </Text>
                ) : null}
              </View>
              {week.workouts.map((workout) => (
                <View
                  key={workout.workoutId}
                  style={[styles.cell, styles.rowDivider, { borderColor: colors.border }, rowStyle(workout.workoutId)]}
                  onLayout={measure(workout.workoutId)}>
                  <PeriodizationCell plan={plan} week={week} workout={workout} />
                </View>
              ))}
              <View
                style={[styles.cell, styles.rowDivider, { borderColor: colors.border }, rowStyle(FOOTER_ROW)]}
                onLayout={measure(FOOTER_ROW)}>
                <WeekTotals week={week} />
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  chips: { gap: spacing.sm },
  table: { flexDirection: 'row' },
  cell: { padding: spacing.sm, gap: spacing.xs, borderRadius: radius.sm },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth },
});
