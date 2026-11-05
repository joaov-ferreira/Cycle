import { useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { layout, spacing } from '@/constants/theme';
import { LIFTS } from '@/domain/lifts';
import type {
  GeneratedSession,
  Periodization,
  Volume,
} from '@/domain/periodization';
import { useI18n } from '@/i18n';

import { useTheme } from '../theme-provider';
import { Card, SegmentedControl, Text } from '../ui';
import { SessionItems, useSessionContext } from './session-prescription';

const WEEKS = [1, 2, 3] as const;
type WeekNumber = (typeof WEEKS)[number];

/** One table row per session slot: its header session and the cell of each block week. */
type Row = { slotId: number; header: GeneratedSession; cells: (GeneratedSession | null)[] };

function rowsOf(periodization: Periodization): Row[] {
  const rows = new Map<number, Row>();
  for (const week of periodization.weeks) {
    for (const session of week.sessions) {
      const row = rows.get(session.slotId) ?? { slotId: session.slotId, header: session, cells: [null, null, null] };
      row.cells[week.blockWeek - 1] = session;
      rows.set(session.slotId, row);
    }
  }
  return [...rows.values()].sort((a, b) => a.header.sessionNumber - b.header.sessionNumber);
}

/** Params for the volume messages: formatted tonnage and the rep count (plural selector). */
function useVolumeParams() {
  const { formatKg } = useI18n();
  return (volume: Volume) => ({ tonnage: formatKg(volume.tonnageKg), count: volume.totalReps });
}

/** One session of one block week: program week/day, sets with exact → rounded loads, volume. */
function SessionCell({ session, testID }: { session: GeneratedSession | null; testID: string }) {
  const { t } = useI18n();
  const volume = useVolumeParams();
  const sessionContext = useSessionContext();
  if (!session) {
    return (
      <View testID={testID} style={styles.cell}>
        <Text tone="secondary">{t('periodization.table.noSession')}</Text>
      </View>
    );
  }
  return (
    <View testID={testID} style={styles.cell}>
      <Text variant="caption" tone="secondary">
        {sessionContext(session)}
      </Text>
      <SessionItems session={session} />
      <Text variant="caption" tone="secondary" tabular>
        {t('periodization.table.volume', volume(session.volume))}
      </Text>
    </View>
  );
}

function RowHeader({ session }: { session: GeneratedSession }) {
  const { t } = useI18n();
  return (
    <View style={styles.rowHeader}>
      <Text variant="label">{t('periodization.slot.title', { number: session.sessionNumber })}</Text>
      <Text tone="secondary">
        {t('periodization.table.sessionSummary', { lift: t(`lifts.${session.lift}`), program: session.templateName })}
      </Text>
    </View>
  );
}

function WeekTotal({ periodization, week }: { periodization: Periodization; week: number }) {
  const { t } = useI18n();
  const volume = useVolumeParams();
  return (
    <Text variant="label" tabular>
      {t('periodization.table.weekTotal', { week, ...volume(periodization.weeks[week - 1].volume) })}
    </Text>
  );
}

/**
 * Three-week table (SPEC §6-A): rows = sessions, columns = block weeks, cell = sets × reps @ %
 * with the exact and rounded load. Wide screens show the three weeks side by side; phones show
 * one week at a time with a week toggle.
 */
export function PeriodizationTable({ periodization }: { periodization: Periodization }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const volume = useVolumeParams();
  const { width } = useWindowDimensions();
  const wide = width >= layout.wideBreakpoint;
  const [week, setWeek] = useState<WeekNumber>(1);
  const rows = useMemo(() => rowsOf(periodization), [periodization]);
  const border = { borderColor: colors.border };

  return (
    <View style={styles.root}>
      <Text variant="heading">{t('periodization.table.title')}</Text>
      {rows.length === 0 ? (
        <Text tone="secondary">{t('periodization.table.empty')}</Text>
      ) : wide ? (
        <Card style={styles.grid}>
          <View style={[styles.gridRow, border]}>
            <Text variant="label" style={styles.gridHeaderCell}>
              {t('periodization.table.session')}
            </Text>
            {WEEKS.map((w) => (
              <Text key={w} variant="label" style={styles.gridCell}>
                {t('periodization.table.week', { week: w })}
              </Text>
            ))}
          </View>
          {rows.map((row) => (
            <View key={row.slotId} style={[styles.gridRow, border]}>
              <View style={styles.gridHeaderCell}>
                <RowHeader session={row.header} />
              </View>
              {WEEKS.map((w) => (
                <View key={w} style={styles.gridCell}>
                  <SessionCell session={row.cells[w - 1]} testID={`cell-${row.slotId}-w${w}`} />
                </View>
              ))}
            </View>
          ))}
          <View style={styles.gridRow}>
            <View style={styles.gridHeaderCell} />
            {WEEKS.map((w) => (
              <View key={w} style={styles.gridCell}>
                <WeekTotal periodization={periodization} week={w} />
              </View>
            ))}
          </View>
        </Card>
      ) : (
        <>
          <SegmentedControl
            label={t('periodization.table.weekSelector')}
            options={WEEKS.map((w) => ({ value: String(w), label: t('periodization.table.week', { week: w }) }))}
            value={String(week)}
            onChange={(value) => setWeek(Number(value) as WeekNumber)}
          />
          {rows.map((row) => (
            <Card key={row.slotId}>
              <RowHeader session={row.header} />
              <SessionCell session={row.cells[week - 1]} testID={`cell-${row.slotId}-w${week}`} />
            </Card>
          ))}
          <WeekTotal periodization={periodization} week={week} />
        </>
      )}
      {rows.length > 0 ? (
        <Card>
          {LIFTS.flatMap((lift) => {
            const liftVolume = periodization.volumeByLift[lift];
            return liftVolume
              ? [
                  <Text key={lift} tabular>
                    {t('periodization.table.liftTotal', { lift: t(`lifts.${lift}`), ...volume(liftVolume) })}
                  </Text>,
                ]
              : [];
          })}
          <Text variant="label" tabular>
            {t('periodization.table.blockTotal', volume(periodization.volume))}
          </Text>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  cell: { gap: spacing.sm },
  rowHeader: { gap: spacing.xs },
  grid: { padding: 0, gap: 0 },
  gridRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  gridHeaderCell: { flex: 1, padding: spacing.md },
  gridCell: { flex: 1.3, padding: spacing.md },
});
