import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { Card, Screen, Text } from '@/components/ui';
import { useT } from '@/i18n';

export default function MoreScreen() {
  const t = useT();
  const router = useRouter();
  return (
    <Screen title={t('screens.more.title')} testID="screen-more">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('screens.more.history')}
        onPress={() => router.push('/history')}>
        <Card>
          <Text variant="heading">{t('screens.more.history')}</Text>
          <Text tone="secondary">{t('screens.more.historyDescription')}</Text>
        </Card>
      </Pressable>
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
