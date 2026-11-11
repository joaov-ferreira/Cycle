import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/constants/theme';

import { useTheme } from '../theme-provider';
import { Text } from '../ui';

/** A small pill with a caption (deload phase, record). `accent` uses the accent fill. */
export function WorkoutBadge({ label, accent = false }: { label: string; accent?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.badge,
        accent
          ? { backgroundColor: colors.accent, borderColor: colors.accent }
          : { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
      ]}>
      <Text variant="caption" style={{ color: accent ? colors.onAccent : colors.text }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
  },
});
