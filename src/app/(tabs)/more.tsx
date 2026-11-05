import { Card, Screen, Text } from '@/components/ui';
import { useT, type MessageKey } from '@/i18n';

const SECTIONS: readonly { title: MessageKey; description: MessageKey }[] = [
  { title: 'screens.more.programs', description: 'screens.more.programsDescription' },
  { title: 'screens.more.history', description: 'screens.more.historyDescription' },
  { title: 'screens.more.settings', description: 'screens.more.settingsDescription' },
];

export default function MoreScreen() {
  const t = useT();
  return (
    <Screen title={t('screens.more.title')} testID="screen-more">
      {SECTIONS.map((section) => (
        <Card key={section.title}>
          <Text variant="heading">{t(section.title)}</Text>
          <Text tone="secondary">{t(section.description)}</Text>
          <Text variant="caption" tone="secondary">
            {t('common.comingSoon')}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}
