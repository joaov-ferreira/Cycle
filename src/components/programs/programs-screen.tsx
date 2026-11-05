import { Pressable, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { groupByFamily, listTemplates } from '@/programs/registry';
import type { ProgramTemplate } from '@/programs/schema';

import { Button, Card, Screen, Text } from '../ui';
import { VerificationBadge } from './verification-badge';

export type ProgramsScreenProps = {
  onOpen: (templateId: string) => void;
  onBack?: () => void;
};

function TemplateCard({ template, onOpen }: { template: ProgramTemplate; onOpen: (templateId: string) => void }) {
  const { t } = useI18n();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('programs.open', { name: template.name })}
      onPress={() => onOpen(template.id)}>
      <Card>
        <Text variant="heading">{template.name}</Text>
        <VerificationBadge status={template.verification} />
        <Text tone="secondary">{t('programs.version', { version: template.version })}</Text>
        <Text tone="secondary">{t('programs.detail.author', { author: template.source.author })}</Text>
        <Text tone="secondary">{t('programs.detail.reference', { reference: template.source.reference })}</Text>
        <Text tone="secondary">{t('programs.duration', { count: template.durationWeeks })}</Text>
        <Text tone="secondary">{t('programs.frequency', { count: template.daysPerWeek })}</Text>
      </Card>
    </Pressable>
  );
}

/**
 * Programs: every template of the program database with its source and verification status.
 * Families with several templates (Sheiko) are grouped under the family name.
 */
export function ProgramsScreen({ onOpen, onBack }: ProgramsScreenProps) {
  const { t } = useI18n();
  return (
    <Screen title={t('programs.title')} testID="screen-programs">
      {onBack ? <Button variant="secondary" label={t('programs.back')} onPress={onBack} /> : null}
      <Text tone="secondary">{t('programs.intro')}</Text>
      {groupByFamily(listTemplates()).map((group) =>
        group.templates.length === 1 ? (
          <TemplateCard key={group.family} template={group.templates[0]} onOpen={onOpen} />
        ) : (
          <View key={group.family} testID={`program-family-${group.family}`} style={{ gap: spacing.md }}>
            <Text variant="heading">{t(`programs.family.${group.family}`)}</Text>
            {group.templates.map((template) => (
              <TemplateCard key={template.id} template={template} onOpen={onOpen} />
            ))}
          </View>
        ),
      )}
    </Screen>
  );
}
