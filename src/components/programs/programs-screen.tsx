import { Pressable } from 'react-native';

import { useI18n } from '@/i18n';
import { listTemplates } from '@/programs/registry';

import { Button, Card, Screen, Text } from '../ui';
import { VerificationBadge } from './verification-badge';

export type ProgramsScreenProps = {
  onOpen: (templateId: string) => void;
  onBack?: () => void;
};

/** Programs: every template of the program database with its source and verification status. */
export function ProgramsScreen({ onOpen, onBack }: ProgramsScreenProps) {
  const { t } = useI18n();
  return (
    <Screen title={t('programs.title')} testID="screen-programs">
      {onBack ? <Button variant="secondary" label={t('programs.back')} onPress={onBack} /> : null}
      <Text tone="secondary">{t('programs.intro')}</Text>
      {listTemplates().map((template) => (
        <Pressable
          key={template.id}
          accessibilityRole="button"
          accessibilityLabel={t('programs.open', { name: template.name })}
          onPress={() => onOpen(template.id)}>
          <Card>
            <Text variant="heading">{template.name}</Text>
            <VerificationBadge status={template.verification} />
            <Text tone="secondary">{t('programs.version', { version: template.version })}</Text>
            <Text tone="secondary">{t('programs.detail.author', { author: template.source.author })}</Text>
            <Text tone="secondary">
              {t('programs.detail.reference', { reference: template.source.reference })}
            </Text>
            <Text tone="secondary">{t('programs.duration', { count: template.durationWeeks })}</Text>
            <Text tone="secondary">{t('programs.frequency', { count: template.daysPerWeek })}</Text>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
