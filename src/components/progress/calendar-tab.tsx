import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/constants/theme';
import { calendarGrid, localDateKey } from '@/domain/insights';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';
import { selectMonthWorkoutCount, selectTrainingDays, selectWeekStreak } from '@/state/selectors-v3';

import { useTheme } from '../theme-provider';
import { Button, Card, Text } from '../ui';

const CELL_HEIGHT = 44;
/** A Monday (2 Nov 2026, month index 10), to derive the weekday names. */
const MONDAY = { year: 2026, month: 10, day: 2 };

/** Progress → Calendar (SPEC-v3 §10): month grid with trained days, the streak and the month's count. */
export function CalendarTab({ now }: { now: Date }) {
  const { t, formatDate } = useI18n();
  const { colors } = useTheme();
  const [shown, setShown] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });

  const days = useAppStore((state) => selectTrainingDays(state, shown.year, shown.month));
  const monthCount = useAppStore((state) => selectMonthWorkoutCount(state, shown.year, shown.month));
  const streak = useAppStore((state) => selectWeekStreak(state, now));

  const isCurrentMonth = shown.year === now.getFullYear() && shown.month === now.getMonth() + 1;
  const grid = calendarGrid(shown.year, shown.month);
  const todayKey = localDateKey(now);

  const move = (delta: number) => {
    const target = new Date(shown.year, shown.month - 1 + delta, 1);
    setShown({ year: target.getFullYear(), month: target.getMonth() + 1 });
  };

  const weekdays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(MONDAY.year, MONDAY.month, MONDAY.day + index);
    return {
      initial: formatDate(date, { weekday: 'narrow' }),
      name: formatDate(date, { weekday: 'long' }),
    };
  });

  return (
    <>
      <Card testID="calendar-summary">
        {streak >= 1 ? <Text variant="heading">{t('insights.calendar.streak', { count: streak })}</Text> : null}
        <Text tone="secondary" tabular>
          {t('insights.calendar.monthCount', { count: monthCount })}
        </Text>
      </Card>

      <Card testID="calendar-grid">
        <View style={styles.nav}>
          <Button variant="secondary" label="‹" accessibilityLabel={t('insights.calendar.previousMonth')} onPress={() => move(-1)} />
          <Text variant="heading" style={styles.title}>
            {formatDate(new Date(shown.year, shown.month - 1, 1), { month: 'long', year: 'numeric' })}
          </Text>
          <Button
            variant="secondary"
            label="›"
            accessibilityLabel={t('insights.calendar.nextMonth')}
            disabled={isCurrentMonth}
            onPress={() => move(1)}
          />
        </View>

        <View style={styles.week}>
          {weekdays.map((weekday) => (
            <View key={weekday.name} accessible accessibilityLabel={weekday.name} style={styles.cell}>
              <Text variant="caption" tone="secondary">
                {weekday.initial}
              </Text>
            </View>
          ))}
        </View>

        {grid.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.week}>
            {row.map((day, columnIndex) => {
              if (day === null) return <View key={columnIndex} style={styles.cell} />;
              const date = new Date(shown.year, shown.month - 1, day);
              const key = localDateKey(date);
              const trained = days[key];
              const today = key === todayKey;
              const dateText = formatDate(date, { day: 'numeric', month: 'long' });
              const label = trained
                ? t(trained.deload ? 'insights.calendar.dayDeload' : 'insights.calendar.day', {
                    date: dateText,
                    count: trained.count,
                  })
                : today
                  ? t('insights.calendar.today', { date: dateText })
                  : dateText;
              return (
                <View
                  key={columnIndex}
                  accessible
                  accessibilityLabel={label}
                  testID={`day-${key}`}
                  style={styles.cell}>
                  <View
                    style={[
                      styles.day,
                      trained && { backgroundColor: trained.deload ? colors.text : colors.accent },
                      today && { borderWidth: 2, borderColor: colors.accentText },
                    ]}>
                    <Text
                      variant="label"
                      tabular
                      style={trained ? { color: trained.deload ? colors.background : colors.onAccent } : undefined}>
                      {day}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { flex: 1, textAlign: 'center' },
  week: { flexDirection: 'row' },
  cell: { flex: 1, height: CELL_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  day: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
