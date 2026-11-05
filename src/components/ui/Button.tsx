import { Pressable, StyleSheet } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';

import { useTheme } from '../theme-provider';
import { Text } from './Text';

export type ButtonProps = {
  label: string;
  /** Accessible name when the visible label is too short to stand alone (defaults to `label`). */
  accessibilityLabel?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  hint?: string;
  testID?: string;
};

/** Accessible button with a ≥ 44 pt touch target. `primary` is the only accent-colored action. */
export function Button({ label, accessibilityLabel, onPress, variant = 'primary', disabled, hint, testID }: ButtonProps) {
  const { colors } = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: primary ? colors.accent : colors.surfaceRaised },
        (pressed || disabled) && styles.dimmed,
      ]}>
      <Text variant="label" style={{ color: primary ? colors.onAccent : colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.minTouchTarget,
    minWidth: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: { opacity: 0.6 },
});
