import { useT, type MessageKey } from '@/i18n';

import { Card, Screen, Text } from './ui';

export type PlaceholderScreenProps = {
  /** Used for the screen testID (`screen-<id>`). */
  id: string;
  title: MessageKey;
  description: MessageKey;
};

/** Minimal screen for sections whose feature arrives in a later stage (see docs/PLAN.md). */
export function PlaceholderScreen({ id, title, description }: PlaceholderScreenProps) {
  const t = useT();
  return (
    <Screen title={t(title)} testID={`screen-${id}`}>
      <Card>
        <Text tone="secondary">{t(description)}</Text>
        <Text variant="caption" tone="secondary">
          {t('common.comingSoon')}
        </Text>
      </Card>
    </Screen>
  );
}
