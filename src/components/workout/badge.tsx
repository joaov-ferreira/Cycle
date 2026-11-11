import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/constants/theme';

import { useTheme } from '../theme-provider';
import { Text } from '../ui/Text';

/** A small outlined label (e.g. "Deload"). */
export function Badge({ label, testID }: { label: string; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={[styles.badge, { borderColor: colors.accent }]}>
      <Text variant="caption" tone="accent">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
