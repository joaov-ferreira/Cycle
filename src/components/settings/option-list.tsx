import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';

import { useTheme } from '../theme-provider';
import { Text } from '../ui';

export type Option<T extends string> = { value: T; label: string; description?: string };

export type OptionListProps<T extends string> = {
  /** Accessible name of the whole group (localized). */
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * A group of mutually exclusive choices, each with an optional one-line description. The
 * selected choice uses the accent fill; every option is a button with a ≥ 44 pt target.
 */
export function OptionList<T extends string>({ label, options, value, onChange }: OptionListProps<T>) {
  const { colors } = useTheme();
  return (
    <View accessibilityLabel={label} style={styles.group}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityHint={option.description}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.option, { backgroundColor: selected ? colors.accent : colors.surfaceRaised }]}>
            <Text variant="label" style={{ color: selected ? colors.onAccent : colors.text }}>
              {option.label}
            </Text>
            {option.description ? (
              <Text variant="caption" style={{ color: selected ? colors.onAccent : colors.textSecondary }}>
                {option.description}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.xs },
  option: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs / 2,
    justifyContent: 'center',
  },
});
