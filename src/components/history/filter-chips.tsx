import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';

import { useTheme } from '../theme-provider';
import { Text } from '../ui';

export type ChipOption<T extends string> = { value: T; label: string };

/** A wrapping row of mutually exclusive filter chips (for filters with many or long options). */
export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  /** Visible and accessible name of the group (localized). */
  label: string;
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <View accessibilityLabel={label} style={styles.row}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={[
                styles.chip,
                { borderColor: colors.border, backgroundColor: selected ? colors.accent : colors.surface },
              ]}>
              <Text variant="label" style={{ color: selected ? colors.onAccent : colors.text }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
