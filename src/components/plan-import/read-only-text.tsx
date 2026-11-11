import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/constants/theme';

import { useTheme } from '../theme-provider';
import { Text } from '../ui';

/** A read-only, selectable, multi-line text block (the copy fallback when sharing is unavailable). */
export function ReadOnlyText({ label, value, testID }: { label: string; value: string; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text selectable accessibilityLabel={label} testID={testID} style={styles.mono}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  mono: { fontFamily: 'monospace', fontSize: 13, lineHeight: 18 },
});
