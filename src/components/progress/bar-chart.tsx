import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/constants/theme';

import { useTheme } from '../theme-provider';
import { Text } from '../ui';

export type Bar = {
  key: string;
  /** Short label under the bar. */
  label: string;
  value: number;
  /** The value as printed above the bar. */
  valueText: string;
  /** Accessible name of the bar (week and value). */
  accessibilityLabel: string;
};

export type BarChartProps = {
  bars: readonly Bar[];
  /** Accessible name of the whole chart. */
  label: string;
  testID?: string;
};

const PLOT_HEIGHT = 120;

/** A simple vertical bar chart: heights proportional to the largest value; one accessible element per bar. */
export function BarChart({ bars, label, testID }: BarChartProps) {
  const { colors } = useTheme();
  const largest = Math.max(0, ...bars.map((bar) => bar.value));
  return (
    <View accessibilityLabel={label} testID={testID} style={styles.row}>
      {bars.map((bar) => (
        <View
          key={bar.key}
          accessible
          accessibilityLabel={bar.accessibilityLabel}
          testID={`bar-${bar.key}`}
          style={styles.column}>
          <Text variant="caption" tabular numberOfLines={1}>
            {bar.valueText}
          </Text>
          <View style={styles.plot}>
            <View
              style={[
                styles.bar,
                { backgroundColor: colors.accent, height: largest === 0 ? 0 : (bar.value / largest) * PLOT_HEIGHT },
              ]}
            />
          </View>
          <Text variant="caption" tone="secondary" style={styles.label}>
            {bar.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-end' },
  column: { flex: 1, alignItems: 'center', gap: spacing.xs },
  plot: { height: PLOT_HEIGHT, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  // Eight labels share a phone's width: a smaller type that wraps (never an ellipsis) keeps every date readable.
  label: { fontSize: 11, lineHeight: 14, textAlign: 'center' },
  bar: { width: '70%', borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm },
});
