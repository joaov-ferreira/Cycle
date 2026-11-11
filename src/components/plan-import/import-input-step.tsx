import { StyleSheet, TextInput, View } from 'react-native';

import { layout, radius, spacing, typography } from '@/constants/theme';
import type { ImportError } from '@/domain/plan-import';
import { useI18n } from '@/i18n';

import { useTheme } from '../theme-provider';
import { Button, Card, Text } from '../ui';
import { describeImportError } from './messages';

export type ImportInputStepProps = {
  text: string;
  onChangeText: (text: string) => void;
  errors: ImportError[];
  /** A localized notice (empty input, rejected file…). */
  notice: string | null;
  onPickFile: () => void;
  onCreateWithAi: () => void;
  onContinue: () => void;
};

/** Step 1 of the import: paste or pick the plan text, or ask an AI chatbot for it. */
export function ImportInputStep({
  text,
  onChangeText,
  errors,
  notice,
  onPickFile,
  onCreateWithAi,
  onContinue,
}: ImportInputStepProps) {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <>
      <Text tone="secondary">{t('planImport.input.hint')}</Text>
      <View style={styles.field}>
        <Text variant="label">{t('planImport.input.pasteLabel')}</Text>
        <TextInput
          accessibilityLabel={t('planImport.input.pasteLabel')}
          value={text}
          onChangeText={onChangeText}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          textAlignVertical="top"
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.input,
            { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        />
      </View>
      <View style={styles.actions}>
        <Button variant="secondary" label={t('planImport.input.pickFile')} hint={t('planImport.input.pickFileHint')} onPress={onPickFile} />
        <Button variant="secondary" label={t('planImport.input.createWithAi')} onPress={onCreateWithAi} />
      </View>
      {notice ? (
        <Text tone="danger" accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}
      {errors.length > 0 ? (
        <Card testID="import-errors">
          <Text variant="heading" tone="danger">
            {t('planImport.input.errorsTitle')}
          </Text>
          {errors.map((error, index) => (
            <Text key={index} tone="danger">
              {describeImportError(t, error)}
            </Text>
          ))}
        </Card>
      ) : null}
      <Button label={t('planImport.input.continue')} onPress={onContinue} />
      <Card>
        <Text variant="label">{t('planImport.input.exampleTitle')}</Text>
        <Text selectable style={styles.mono}>
          {t('planImport.input.example')}
        </Text>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  input: {
    ...typography.body,
    minHeight: layout.minTouchTarget * 4,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  mono: { fontFamily: 'monospace', fontSize: 13, lineHeight: 18 },
});
