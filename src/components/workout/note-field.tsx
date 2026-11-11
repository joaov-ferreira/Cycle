import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { layout, radius, spacing, typography } from '@/constants/theme';

import { useTheme } from '../theme-provider';
import { Text } from '../ui/Text';
import { useAction } from './use-action';

export type NoteFieldProps = {
  /** Localized label, also the accessible name. */
  label: string;
  value: string;
  /** Saves the text; a rejection (e.g. too long) is shown under the field. */
  onSave: (text: string) => Promise<unknown>;
  /** Limit quoted when the store rejects the text as too long (default: the session note's). */
  maxChars?: number;
  testID?: string;
};

/** Multi-line note that saves as the user types and shows the store's rejection, if any. */
export function NoteField({ label, value, onSave, maxChars, testID }: NoteFieldProps) {
  const { colors } = useTheme();
  const [text, setText] = useState(value);
  const { error, run } = useAction({ noteMax: maxChars });

  return (
    <View style={styles.container}>
      <TextInput
        accessibilityLabel={label}
        testID={testID}
        multiline
        value={text}
        placeholder={label}
        placeholderTextColor={colors.textSecondary}
        onChangeText={(next) => {
          setText(next);
          void run(() => onSave(next));
        }}
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
    textAlignVertical: 'top',
  },
});
