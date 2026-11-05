import { StyleSheet, View, type ViewProps } from 'react-native';

import { radius, spacing } from '@/constants/theme';

import { useTheme } from '../theme-provider';

/** Bordered surface that groups related content. */
export function Card({ style, ...rest }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
