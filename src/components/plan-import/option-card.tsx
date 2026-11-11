import { Pressable, StyleSheet } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';

import { useTheme } from '../theme-provider';
import { Text } from '../ui';

/** A large tappable card with a title and a description; the accessible name is the title. */
export function OptionCard({
  title,
  body,
  meta,
  accessibilityLabel,
  onPress,
  testID,
}: {
  title: string;
  body?: string;
  /** Extra line under the description (e.g. a summary). */
  meta?: string;
  /** Accessible name when it should differ from the visible title. */
  accessibilityLabel?: string;
  onPress: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={body}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}>
      <Text variant="heading">{title}</Text>
      {body ? <Text tone="secondary">{body}</Text> : null}
      {meta ? <Text variant="label">{meta}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: layout.minTouchTarget,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.6 },
});
