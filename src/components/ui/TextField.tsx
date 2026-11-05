import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { layout, radius, spacing, typography } from '@/constants/theme';

import { useTheme } from '../theme-provider';
import { Text } from './Text';

export type TextFieldProps = {
  /** Visible label, also the accessible name of the field (localized). */
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Localized error message, shown under the field. */
  error?: string | null;
  /** Soft-keyboard type, e.g. `decimal` for weights. */
  inputMode?: TextInputProps['inputMode'];
  testID?: string;
};

/** Single-line text input with a label and an optional error message. */
export function TextField({ label, value, onChangeText, error, inputMode, testID }: TextFieldProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        inputMode={inputMode}
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
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
});
