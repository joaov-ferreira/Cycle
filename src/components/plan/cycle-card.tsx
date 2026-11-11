import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';
import { cycleTimeline } from '@/domain/cycle';
import type { Plan } from '@/domain/plan';
import { useI18n, type MessageKey } from '@/i18n';
import { selectActivePlan, selectDeloadAdvice, useAppStore } from '@/state';

import { Chip, ConfirmDialog } from '../shared';
import { useTheme } from '../theme-provider';
import { Button, Card, Text } from '../ui';
import { CycleSettings } from './cycle-settings';
import { adviceText, cycleStatusText } from './cycle-text';

type Pending = 'startDeload' | 'endDeload' | 'restart';

const DIALOG: Record<Pending, { title: MessageKey; message: MessageKey }> = {
  startDeload: { title: 'plan.cycle.startDeloadTitle', message: 'plan.cycle.startDeloadMessage' },
  endDeload: { title: 'plan.cycle.endDeloadTitle', message: 'plan.cycle.endDeloadMessage' },
  restart: { title: 'plan.cycle.restartTitle', message: 'plan.cycle.restartMessage' },
};

/**
 * The cycle card (SPEC §5.5): status line, week timeline, sessions counter, deload advice
 * (for the active plan), start/end deload and restart actions, and the cycle settings.
 */
export function CycleCard({ plan }: { plan: Plan }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const isActive = useAppStore((s) => selectActivePlan(s)?.id === plan.id);
  const advice = useAppStore(selectDeloadAdvice);
  const startDeload = useAppStore((s) => s.startDeload);
  const startNewCycle = useAppStore((s) => s.startNewCycle);
  const dismissAdvice = useAppStore((s) => s.dismissDeloadAdvice);
  const [pending, setPending] = useState<Pending | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { cycleState: state, cycle } = plan;
  const timeline = useMemo(() => cycleTimeline(cycle, state), [cycle, state]);
  const inDeload = state.phase === 'deload';
  const status = cycleStatusText(t, cycle, state);

  const attempt = async (job: () => Promise<unknown>) => {
    setError(null);
    try {
      await job();
    } catch {
      setError(t('plan.errors.generic'));
    }
  };

  const confirm = async () => {
    const action = pending;
    setPending(null);
    if (action === 'startDeload') await attempt(() => startDeload(plan.id));
    else if (action) await attempt(() => startNewCycle(plan.id));
  };

  const early = isActive && advice.kind === 'early' ? advice : null;
  const banner = isActive ? adviceText(t, advice) : null;

  return (
    <Card testID="cycle-card">
      <Text variant="heading">{t('plan.cycle.heading')}</Text>
      <Text testID="cycle-status">{status}</Text>

      <View style={styles.timeline} accessibilityLabel={t('plan.cycle.timeline')} testID="cycle-timeline">
        {timeline.map((cell) => {
          const hasTarget = cell.targetRir !== undefined;
          const args = { week: cell.week, rir: cell.targetRir ?? 0 };
          const label =
            cell.phase === 'load'
              ? cell.current
                ? hasTarget
                  ? t('plan.cycle.cellLoadTargetCurrent', args)
                  : t('plan.cycle.cellLoadCurrent', args)
                : hasTarget
                  ? t('plan.cycle.cellLoadTarget', args)
                  : t('plan.cycle.cellLoad', args)
              : cell.current
                ? hasTarget
                  ? t('plan.cycle.cellDeloadTargetCurrent', args)
                  : t('plan.cycle.cellDeloadCurrent', args)
                : hasTarget
                  ? t('plan.cycle.cellDeloadTarget', args)
                  : t('plan.cycle.cellDeload', args);
          const short = t(cell.phase === 'load' ? 'plan.cycle.cellShortLoad' : 'plan.cycle.cellShortDeload', {
            week: cell.week,
          });
          return (
            <View
              key={`${cell.phase}-${cell.week}`}
              accessible
              accessibilityLabel={label}
              style={[
                styles.cell,
                {
                  backgroundColor: cell.current
                    ? colors.accent
                    : cell.phase === 'load'
                      ? colors.surfaceRaised
                      : colors.surface,
                  borderColor: cell.current ? colors.accent : cell.phase === 'deload' ? colors.accentText : colors.border,
                  borderStyle: cell.phase === 'deload' ? 'dashed' : 'solid',
                },
              ]}>
              <Text
                variant="caption"
                tabular
                importantForAccessibility="no"
                style={{ color: cell.current ? colors.onAccent : colors.text }}>
                {short}
              </Text>
              {hasTarget ? (
                <Text
                  variant="caption"
                  tabular
                  importantForAccessibility="no"
                  style={{ color: cell.current ? colors.onAccent : colors.textSecondary }}>
                  {t('plan.cycle.cellRir', { rir: cell.targetRir ?? 0 })}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>

      <Text tone="secondary">
        {t('plan.cycle.sessions', { done: state.sessionsDoneThisWeek, total: plan.sessionsPerWeek })}
      </Text>

      {banner ? (
        <View style={[styles.banner, { borderColor: colors.accentText, backgroundColor: colors.surfaceRaised }]} testID="deload-advice">
          <Text accessibilityRole="alert">{banner}</Text>
          {early ? (
            <View style={styles.actions}>
              <Button label={t('plan.cycle.startDeload')} onPress={() => setPending('startDeload')} />
              <Button variant="secondary" label={t('plan.cycle.dismiss')} onPress={() => dismissAdvice()} />
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        {inDeload ? (
          <Button variant="secondary" label={t('plan.cycle.endDeload')} onPress={() => setPending('endDeload')} />
        ) : early ? null : (
          <Button variant="secondary" label={t('plan.cycle.startDeload')} onPress={() => setPending('startDeload')} />
        )}
        <Button variant="secondary" label={t('plan.cycle.restart')} onPress={() => setPending('restart')} />
      </View>

      {error ? (
        <Text tone="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Chip
          label={t('plan.cycle.settings')}
          selected={showSettings}
          onPress={() => setShowSettings((v) => !v)}
        />
      </View>
      {showSettings ? <CycleSettings plan={plan} /> : null}

      <ConfirmDialog
        visible={pending !== null}
        title={t(DIALOG[pending ?? 'restart'].title)}
        message={t(DIALOG[pending ?? 'restart'].message)}
        confirmLabel={t('common.confirm')}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  timeline: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  cell: {
    minWidth: layout.minTouchTarget - spacing.sm,
    minHeight: layout.minTouchTarget - spacing.sm,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
