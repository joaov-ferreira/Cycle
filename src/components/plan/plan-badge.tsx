import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/constants/theme';

import { useTheme } from '../theme-provider';
import { Text } from '../ui';

/** Small pill: "Active", "Archived", "Next". */
export function PlanBadge({ label, testID }: { label: string; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={[styles.badge, { borderColor: colors.accentText }]}>
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
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
});
