import { Pressable, StyleSheet, View } from 'react-native';

import { layout, spacing } from '@/constants/theme';
import type { GeneratedSession, Periodization } from '@/domain/periodization';
import { useI18n } from '@/i18n';

import { useTheme } from '../theme-provider';
import { Text } from '../ui';
import { useSetLine } from './session-prescription';

export type PeriodizationCalendarProps = {
  periodization: Periodization;
  /** Called with the session key (`<slotId>-w<blockWeek>`) of the tapped card. */
  onOpenSession: (sessionKey: string) => void;
};

function SessionCard({ session, onOpen }: { session: GeneratedSession; onOpen: () => void }) {
  const { t, formatKg } = useI18n();
  const { colors } = useTheme();
  const setLine = useSetLine();
  const lift = t(`lifts.${session.lift}`);
  return (
    <Pressable
      testID={`calendar-card-${session.key}`}
      accessibilityRole="button"
      accessibilityLabel={t('periodization.calendar.open', {
        week: session.blockWeek,
        number: session.sessionNumber,
        lift,
        program: session.templateName,
      })}
      onPress={onOpen}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text variant="label">{t('periodization.slot.title', { number: session.sessionNumber })}</Text>
      <Text tone="secondary">
        {t('periodization.table.sessionSummary', { lift, program: session.templateName })}
      </Text>
      {session.items.flatMap((item, itemIndex) =>
        item.kind === 'main'
          ? item.sets.map((set, setIndex) => (
              <Text key={`${itemIndex}-${setIndex}`} tabular>
                {t('periodization.calendar.setLoad', {
                  line: setLine(set),
                  load: set.roundedKg === null ? t('periodization.table.noLoad') : formatKg(set.roundedKg),
                })}
              </Text>
            ))
          : [],
      )}
    </Pressable>
  );
}

/**
 * Calendar (SPEC §6-B): a week × session grid. Each card shows the lift, the program and a set
 * summary, and opens the detailed prescription. It reads the same `Periodization` as the table.
 */
export function PeriodizationCalendar({ periodization, onOpenSession }: PeriodizationCalendarProps) {
  const { t } = useI18n();
  const hasSessions = periodization.weeks.some((week) => week.sessions.length > 0);
  return (
    <View style={styles.root}>
      <Text variant="heading">{t('periodization.calendar.title')}</Text>
      {hasSessions ? (
        periodization.weeks.map((week) => (
          <View key={week.blockWeek} style={styles.week}>
            <Text variant="heading">{t('periodization.table.week', { week: week.blockWeek })}</Text>
            <View style={styles.grid}>
              {week.sessions.map((session) => (
                <SessionCard key={session.key} session={session} onOpen={() => onOpenSession(session.key)} />
              ))}
            </View>
          </View>
        ))
      ) : (
        <Text tone="secondary">{t('periodization.calendar.empty')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  week: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    flexGrow: 1,
    flexBasis: 240,
    minHeight: layout.minTouchTarget,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
  },
});
