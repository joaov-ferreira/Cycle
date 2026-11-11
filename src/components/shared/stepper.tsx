import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, spacing, tabularNumbers } from '@/constants/theme';
import { useI18n } from '@/i18n';

import { useTheme } from '../theme-provider';
import { Text } from '../ui/Text';

export type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** Amount added or subtracted per press. */
  step?: number;
  /** Name of the quantity, used in the accessible labels ("Decrease <label>"). */
  label: string;
  /** Display text for the value; defaults to the locale's number format. */
  format?: (value: number) => string;
  testID?: string;
};

/** Number of decimal digits of a step (`0.25` → 2), so sums stay exact for display. */
function decimalsOf(step: number): number {
  const [, fraction = ''] = String(step).split('.');
  return fraction.length;
}

/** Bounded ± control with buttons of at least 44 pt. Disabled at the bounds. */
export function Stepper({ value, onChange, min, max, step = 1, label, format, testID }: StepperProps) {
  const { colors } = useTheme();
  const { t, formatNumber, locale } = useI18n();
  const decimals = decimalsOf(step);

  const move = (direction: 1 | -1) => {
    const next = Number((value + direction * step).toFixed(decimals));
    onChange(Math.min(max, Math.max(min, next)));
  };

  const display = format ? format(value) : formatNumber(value, { maximumFractionDigits: decimals });
  const decreaseDisabled = value <= min;
  const increaseDisabled = value >= max;

  return (
    <View testID={testID} style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.decrease', { label })}
        accessibilityState={{ disabled: decreaseDisabled }}
        disabled={decreaseDisabled}
        onPress={() => move(-1)}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.surfaceRaised },
          (pressed || decreaseDisabled) && styles.dimmed,
        ]}>
        <Text variant="heading">−</Text>
      </Pressable>
      <Text variant="heading" tabular style={styles.value} accessibilityLabel={label}>
        {display}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.increase', { label })}
        accessibilityState={{ disabled: increaseDisabled }}
        disabled={increaseDisabled}
        onPress={() => move(1)}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.surfaceRaised },
          (pressed || increaseDisabled) && styles.dimmed,
        ]}>
        <Text variant="heading">+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  button: {
    minWidth: layout.minTouchTarget,
    minHeight: layout.minTouchTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { minWidth: spacing.xxl * 2, textAlign: 'center', ...tabularNumbers },
  dimmed: { opacity: 0.4 },
});
