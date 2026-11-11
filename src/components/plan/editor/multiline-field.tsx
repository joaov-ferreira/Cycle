import { StyleSheet, TextInput, View } from 'react-native';

import { layout, radius, spacing, typography } from '@/constants/theme';

import { useTheme } from '../../theme-provider';
import { Text } from '../../ui/Text';

export type MultilineFieldProps = {
  /** Visible label, also the accessible name (localized). */
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string | null;
  testID?: string;
};

/** Multi-line text input with a label and an optional error message. */
export function MultilineField({ label, value, onChangeText, error, testID }: MultilineFieldProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        multiline
        textAlignVertical="top"
        testID={testID}
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
          },
        ]}
      />
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  input: {
    ...typography.body,
    minHeight: layout.minTouchTarget * 2,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
});
