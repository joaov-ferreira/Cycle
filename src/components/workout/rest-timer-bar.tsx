import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/constants/theme';
import { restClock } from '@/domain/rest-timer';
import { useI18n } from '@/i18n';
import { selectRestRemaining, useAppStore } from '@/state';

import { useTheme } from '../theme-provider';
import { Button, Text } from '../ui';

/** Vibration of the end of the rest: two short pulses (SPEC-v3 §1.2). */
export const REST_OVER_VIBRATION = [0, 200, 100, 200];
/** How long "Rest over" stays before the bar clears itself. */
export const REST_OVER_VISIBLE_MS = 4000;

export type RestTimerBarProps = {
  /** Current time in epoch milliseconds (the store's clock in tests). */
  now: () => number;
  vibrate: (pattern: number[]) => void;
};

/**
 * Countdown between sets (SPEC-v3 §1.2): `m:ss`, −15 s, +15 s and Skip. The store keeps only the
 * end timestamp; this bar re-reads the clock once a second.
 */
export function RestTimerBar({ now, vibrate }: RestTimerBarProps) {
  const { colors } = useTheme();
  const { t, formatNumber } = useI18n();
  const rest = useAppStore((s) => s.restTimer);
  const adjustRest = useAppStore((s) => s.adjustRest);
  const skipRest = useAppStore((s) => s.skipRest);
  const remaining = useAppStore((s) => selectRestRemaining(s, now()));
  const [, setTick] = useState(0);

  const active = rest !== null;
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  const over = active && remaining === 0;
  useEffect(() => {
    if (!over) return undefined;
    vibrate(REST_OVER_VIBRATION);
    const id = setTimeout(skipRest, REST_OVER_VISIBLE_MS);
    return () => clearTimeout(id);
    // `vibrate` and `skipRest` are stable per screen; the pulse fires once per end of rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over, rest?.timer.startedAt]);

  if (!rest) return null;

  const clock = restClock(remaining);
  const display = `${formatNumber(clock.minutes, { maximumFractionDigits: 0 })}:${String(clock.seconds).padStart(2, '0')}`;
  const spoken = [
    clock.minutes > 0 ? t('timer.minutes', { count: clock.minutes }) : null,
    clock.seconds > 0 || clock.minutes === 0 ? t('timer.seconds', { count: clock.seconds }) : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' ');

  return (
    <View
      testID="rest-timer-bar"
      style={[styles.bar, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
      <View
        accessible
        accessibilityRole="timer"
        accessibilityLabel={over ? t('timer.over') : t('timer.restAccessible', { time: spoken })}
        accessibilityLiveRegion={over ? 'polite' : 'none'}
        style={styles.clock}>
        <Text variant="caption" tone="secondary">
          {t('timer.rest')}
        </Text>
        <Text variant="label" tabular tone={over ? 'accent' : 'primary'} style={styles.countdown}>
          {over ? t('timer.over') : display}
        </Text>
      </View>
      <Button
        variant="secondary"
        label={t('timer.minus15')}
        accessibilityLabel={t('timer.minus15Accessible')}
        onPress={() => adjustRest(-15)}
      />
      <Button
        variant="secondary"
        label={t('timer.plus15')}
        accessibilityLabel={t('timer.plus15Accessible')}
        onPress={() => adjustRest(15)}
      />
      <Button label={t('timer.skip')} accessibilityLabel={t('timer.skipAccessible')} onPress={skipRest} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  clock: { flex: 1 },
  countdown: { fontSize: 24, lineHeight: 30 },
});
