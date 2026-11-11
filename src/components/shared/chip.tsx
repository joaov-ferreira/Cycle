import { Pressable, StyleSheet } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';

import { useTheme } from '../theme-provider';
import { Text } from '../ui/Text';

export type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
};

/** A selectable pill (filters). Selected chips use the accent fill; touch target ≥ 44 pt. */
export function Chip({ label, selected, onPress, testID }: ChipProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={testID}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.accent : colors.surface,
          borderColor: selected ? colors.accent : colors.border,
        },
      ]}>
      <Text variant="label" style={{ color: selected ? colors.onAccent : colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
