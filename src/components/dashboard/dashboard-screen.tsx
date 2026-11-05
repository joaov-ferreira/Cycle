import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { layout, spacing } from '@/constants/theme';
import { blockProgress, BLOCK_WEEKS } from '@/domain/block-progress';
import { snapshotSessionId } from '@/domain/performance';
import { LIFTS, type Lift } from '@/domain/lifts';
import { useI18n, type MessageKey } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';
import { selectLatestE1rms } from '@/state/dashboard-selectors';
import { selectCurrentOneRms } from '@/state/periodization-selectors';
import { selectTrainingQueue } from '@/state/performance-selectors';

import { Button, Card, Screen, Text } from '../ui';

/** `startDate` is a calendar date: format it in UTC so no time zone shifts the day. */
const UTC_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' };

export type DashboardTarget = 'periodization' | 'training' | 'progress' | 'history';

const SHORTCUTS: readonly { target: DashboardTarget; label: MessageKey }[] = [
  { target: 'training', label: 'tabs.training' },
  { target: 'periodization', label: 'tabs.periodization' },
  { target: 'progress', label: 'tabs.progress' },
  { target: 'history', label: 'screens.more.history' },
];

export type DashboardScreenProps = {
  /** Opens a session of the activated periodization (`p<periodizationId>-<key>`) for logging. */
  onOpenSession: (sessionId: string) => void;
  /** Opens another section of the app. */
  onNavigate: (target: DashboardTarget) => void;
  /** The clock; defaults to the current time. */
  now?: Date;
};

function BlockCard({ now, onNavigate }: { now: Date; onNavigate: DashboardScreenProps['onNavigate'] }) {
  const { t, formatDate } = useI18n();
  const active = useAppStore((s) => s.activePeriodization);
  const { inProgress } = useAppStore(selectTrainingQueue);

  if (!active) {
    return (
      <Card testID="dashboard-block">
        <Text variant="heading">{t('dashboard.block.heading')}</Text>
        <Text tone="secondary">{t('dashboard.block.none')}</Text>
        <Button label={t('dashboard.block.open')} onPress={() => onNavigate('periodization')} />
      </Card>
    );
  }

  const progress = blockProgress(active.startDate, now);
  const status =
    progress.status === 'active'
      ? t('dashboard.block.week', { week: progress.week, total: BLOCK_WEEKS })
      : progress.status === 'upcoming'
        ? t('dashboard.block.upcoming', { count: progress.daysUntilStart })
        : t('dashboard.block.finished');
  return (
    <Card testID="dashboard-block">
      <Text variant="heading">{t('dashboard.block.heading')}</Text>
      <Text variant="title">{status}</Text>
      <Text tone="secondary">{t('dashboard.block.startDate', { date: formatDate(new Date(`${active.startDate}T00:00:00Z`), UTC_DATE) })}</Text>
      {inProgress.length > 0 ? (
        <>
          <Text variant="label">{t('dashboard.inProgress', { count: inProgress.length })}</Text>
          <Button variant="secondary" label={t('dashboard.continue')} onPress={() => onNavigate('training')} />
        </>
      ) : null}
    </Card>
  );
}

function NextSessionCard({ onOpenSession }: Pick<DashboardScreenProps, 'onOpenSession'>) {
  const t = useI18n().t;
  const active = useAppStore((s) => s.activePeriodization);
  const { next } = useAppStore(selectTrainingQueue);
  if (!active) return null;
  return (
    <Card testID="dashboard-next">
      <Text variant="heading">{t('training.next')}</Text>
      {next ? (
        <>
          <Text variant="label">
            {t('training.sessionLine', {
              number: next.session.sessionNumber,
              week: next.session.blockWeek,
              lift: t(`lifts.${next.session.lift}`),
              program: next.session.templateName,
            })}
          </Text>
          <Button
            label={t('training.start')}
            accessibilityLabel={t('training.startFor', {
              number: next.session.sessionNumber,
              week: next.session.blockWeek,
            })}
            onPress={() => onOpenSession(snapshotSessionId(next.periodizationId, next.session.key))}
          />
        </>
      ) : (
        <Text tone="secondary">{t('training.allStarted')}</Text>
      )}
    </Card>
  );
}

function LiftRow({ lift }: { lift: Lift }) {
  const { t, formatKg, formatDate } = useI18n();
  const latest = useAppStore(selectLatestE1rms)[lift];
  const reference = useAppStore(selectCurrentOneRms)[lift];
  const noValue = t('progress.noValue');
  const referenceText = reference === undefined ? t('progress.notSet') : formatKg(reference, { maximumFractionDigits: 1 });
  const value = latest ? formatKg(latest.valueKg, { maximumFractionDigits: 1 }) : noValue;
  const recorded = latest ? t('dashboard.e1rm.recorded', { date: formatDate(new Date(latest.recordedAt)) }) : null;
  const referenceLine = `${t('progress.cards.reference')}: ${referenceText}`;
  const summary = [`${t(`lifts.${lift}`)}: ${value}`, recorded, referenceLine].filter(Boolean);
  return (
    <View testID={`dashboard-e1rm-${lift}`} accessible accessibilityLabel={summary.join('. ')} style={styles.liftRow}>
      <Text variant="label">{t(`lifts.${lift}`)}</Text>
      <Text variant="heading" tabular>
        {value}
      </Text>
      {recorded ? (
        <Text variant="caption" tone="secondary">
          {recorded}
        </Text>
      ) : null}
      <Text variant="caption" tone="secondary" tabular>
        {referenceLine}
      </Text>
    </View>
  );
}

function E1rmCard() {
  const t = useI18n().t;
  const anyEstimate = useAppStore((s) => Object.keys(selectLatestE1rms(s)).length > 0);
  return (
    <Card testID="dashboard-e1rm">
      <Text variant="heading">{t('dashboard.e1rm.heading')}</Text>
      {!anyEstimate ? <Text tone="secondary">{t('dashboard.e1rm.none')}</Text> : null}
      <View style={styles.lifts}>
        {LIFTS.map((lift) => (
          <LiftRow key={lift} lift={lift} />
        ))}
      </View>
    </Card>
  );
}

/**
 * Dashboard (SPEC §11): the current week of the activated block, the next session, the latest
 * e1RM of each lift (with the reference 1RM) and shortcuts. Phones stack the cards; wide screens
 * (≥ 900 px) put the block and the next session beside the estimates.
 */
export function DashboardScreen({ onOpenSession, onNavigate, now: nowOverride }: DashboardScreenProps) {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= layout.wideBreakpoint;
  const now = nowOverride ?? new Date();
  return (
    <Screen title={t('screens.dashboard.title')} testID="screen-dashboard">
      <Text tone="secondary">{t('dashboard.intro')}</Text>
      <View testID="dashboard-grid" style={[styles.grid, { flexDirection: wide ? 'row' : 'column' }]}>
        <View style={wide ? styles.columnWide : styles.column}>
          <BlockCard now={now} onNavigate={onNavigate} />
          <NextSessionCard onOpenSession={onOpenSession} />
        </View>
        <View style={wide ? styles.columnWide : styles.column}>
          <E1rmCard />
        </View>
      </View>
      <Text variant="heading">{t('dashboard.shortcuts.heading')}</Text>
      <View style={styles.shortcuts}>
        {SHORTCUTS.map(({ target, label }) => (
          <Button
            key={target}
            variant="secondary"
            label={t(label)}
            accessibilityLabel={t('dashboard.shortcuts.open', { section: t(label) })}
            onPress={() => onNavigate(target)}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { gap: spacing.lg, alignItems: 'stretch' },
  column: { gap: spacing.lg },
  columnWide: { flex: 1, gap: spacing.lg },
  lifts: { gap: spacing.md },
  liftRow: { gap: spacing.xs / 2 },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
