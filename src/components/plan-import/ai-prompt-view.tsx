import { useT } from '@/i18n';

import { Button, Screen, Text } from '../ui';
import { ReadOnlyText } from './read-only-text';

export type AiPromptViewProps = {
  prompt: string;
  onShare: (text: string) => void;
  onDone: () => void;
};

/** "Create with AI": the four usage steps and the prompt (selectable, shareable). */
export function AiPromptView({ prompt, onShare, onDone }: AiPromptViewProps) {
  const t = useT();
  return (
    <Screen title={t('planImport.ai.title')} testID="screen-plan-import-ai">
      <Button variant="secondary" label={t('planImport.ai.done')} onPress={onDone} />
      <Text tone="secondary">{t('planImport.ai.intro')}</Text>
      <Text>{t('planImport.ai.step1')}</Text>
      <Text>{t('planImport.ai.step2')}</Text>
      <Text>{t('planImport.ai.step3')}</Text>
      <Text>{t('planImport.ai.step4')}</Text>
      <Button label={t('planImport.ai.share')} onPress={() => onShare(prompt)} />
      <Text variant="caption" tone="secondary">
        {t('planImport.ai.shareHint')}
      </Text>
      <ReadOnlyText label={t('planImport.ai.promptLabel')} value={prompt} />
    </Screen>
  );
}
