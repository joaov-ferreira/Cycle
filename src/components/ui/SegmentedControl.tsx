import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';

import { useTheme } from '../theme-provider';
import { Text } from './Text';

export type SegmentOption<T extends string> = { value: T; label: string };

export type SegmentedControlProps<T extends string> = {
  /** Accessible name of the whole group (localized). */
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** A row of mutually exclusive options (e.g. Table | Calendar). */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel={label}
      style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={`segment-${option.value}`}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) onChange(option.value);
            }}
            style={[styles.segment, selected && { backgroundColor: colors.accent }]}>
            <Text variant="label" style={{ color: selected ? colors.onAccent : colors.text }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.xs / 2,
    gap: spacing.xs / 2,
  },
  segment: {
    flex: 1,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
