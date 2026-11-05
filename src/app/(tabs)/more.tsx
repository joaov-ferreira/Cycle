import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { Card, Screen, Text } from '@/components/ui';
import { useT, type MessageKey } from '@/i18n';

const COMING_SOON: readonly { title: MessageKey; description: MessageKey }[] = [
  { title: 'screens.more.history', description: 'screens.more.historyDescription' },
];

export default function MoreScreen() {
  const t = useT();
  const router = useRouter();
  return (
    <Screen title={t('screens.more.title')} testID="screen-more">
      {COMING_SOON.map((section) => (
        <Card key={section.title}>
          <Text variant="heading">{t(section.title)}</Text>
          <Text tone="secondary">{t(section.description)}</Text>
          <Text variant="caption" tone="secondary">
            {t('common.comingSoon')}
          </Text>
        </Card>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('screens.more.programs')}
        onPress={() => router.push('/programs')}>
        <Card>
          <Text variant="heading">{t('screens.more.programs')}</Text>
          <Text tone="secondary">{t('screens.more.programsDescription')}</Text>
        </Card>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('screens.more.settings')}
        onPress={() => router.push('/settings')}>
        <Card>
          <Text variant="heading">{t('screens.more.settings')}</Text>
          <Text tone="secondary">{t('screens.more.settingsDescription')}</Text>
        </Card>
      </Pressable>
    </Screen>
  );
}
