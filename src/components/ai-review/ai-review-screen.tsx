import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { layout, radius, spacing, typography } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';
import { selectAiReviewPrompt } from '@/state/selectors-v3';

import { EmptyState } from '../shared';
import { ReadOnlyText } from '../plan-import/read-only-text';
import { shareText } from '../plan-import/share-text';
import { useTheme } from '../theme-provider';
import { Button, Screen, Text } from '../ui';

export type AiReviewScreenProps = {
  planId: number;
  onBack: () => void;
  /** Opens the import screen with "Update plan" preselected. */
  onImportAnswer: (planId: number) => void;
  /** Overridable for tests; defaults to the platform share sheet. */
  share?: (text: string) => Promise<void>;
};

/** Review with AI (SPEC-v3 §7): usage steps, notes, the prompt, share, and the import entry point. */
export function AiReviewScreen({ planId, onBack, onImportAnswer, share = shareText }: AiReviewScreenProps) {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const [notes, setNotes] = useState('');
  const prompt = useAppStore((s) => selectAiReviewPrompt(s, planId, locale, notes));

  return (
    <Screen title={t('aiReview.title')} testID="screen-ai-review">
      <Button variant="secondary" label={t('aiReview.back')} onPress={onBack} />
      {prompt === null ? (
        <EmptyState title={t('aiReview.notFoundTitle')} message={t('aiReview.notFoundMessage')} />
      ) : (
        <>
          <Text tone="secondary">{t('aiReview.intro')}</Text>
          <Text>{t('aiReview.step1')}</Text>
          <Text>{t('aiReview.step2')}</Text>
          <Text>{t('aiReview.step3')}</Text>
          <Text>{t('aiReview.step4')}</Text>
          <View style={styles.field}>
            <Text variant="label">{t('aiReview.notesLabel')}</Text>
            <TextInput
              accessibilityLabel={t('aiReview.notesLabel')}
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.input,
                { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            />
          </View>
          <Button label={t('aiReview.share')} onPress={() => share(prompt)} />
          <Text variant="caption" tone="secondary">
            {t('aiReview.shareHint')}
          </Text>
          <ReadOnlyText label={t('aiReview.promptLabel')} value={prompt} testID="ai-review-prompt" />
          <Button label={t('aiReview.importAnswer')} onPress={() => onImportAnswer(planId)} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  input: {
    ...typography.body,
    minHeight: layout.minTouchTarget * 2,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
});
