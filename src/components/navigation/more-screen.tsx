import { useRouter, type Href } from 'expo-router';
import { Pressable } from 'react-native';

import { useT, type MessageKey } from '@/i18n';

import { Card, Screen, Text } from '../ui';

const LINKS: readonly { id: string; title: MessageKey; description: MessageKey; href: Href }[] = [
  { id: 'exercises', title: 'exercises.title', description: 'navigation.moreDescriptions.exercises', href: '/exercises' },
  { id: 'history', title: 'history.title', description: 'navigation.moreDescriptions.history', href: '/history' },
  { id: 'settings', title: 'settings.title', description: 'navigation.moreDescriptions.settings', href: '/settings' },
];

/** The More tab: links to the sections that have no tab of their own. */
export function MoreScreen() {
  const t = useT();
  const router = useRouter();
  return (
    <Screen title={t('tabs.more')} testID="screen-more">
      {LINKS.map((link) => (
        <Pressable
          key={link.id}
          testID={`more-link-${link.id}`}
          accessibilityRole="button"
          accessibilityLabel={t(link.title)}
          onPress={() => router.push(link.href)}>
          <Card>
            <Text variant="heading">{t(link.title)}</Text>
            <Text tone="secondary">{t(link.description)}</Text>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
