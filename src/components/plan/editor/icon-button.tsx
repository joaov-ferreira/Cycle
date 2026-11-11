import { Pressable, StyleSheet } from 'react-native';

import { layout, radius } from '@/constants/theme';

import { useTheme } from '../../theme-provider';
import { Text } from '../../ui/Text';

export type IconButtonProps = {
  /** A glyph such as an arrow or a cross; never a word. */
  glyph: string;
  /** Localized accessible name that identifies what the button acts on. */
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

/** Square 44 pt button with a single glyph (move up/down, remove). */
export function IconButton({ glyph, label, onPress, disabled = false, testID }: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: colors.surfaceRaised },
        (pressed || disabled) && styles.dimmed,
      ]}>
      <Text variant="heading">{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: layout.minTouchTarget,
    minHeight: layout.minTouchTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: { opacity: 0.4 },
});
