import { StyleSheet } from 'react-native';

import { spacing } from '@/constants/theme';
import { useT } from '@/i18n';
import type { CompletedCycle } from '@/state/types';

import { Button, Card, Text } from '../ui';

/** "Cycle N complete" with the report link and a dismissal (SPEC-v3 §6). */
export function CycleCompleteBanner({
  completed,
  onOpenReport,
  onDismiss,
}: {
  completed: CompletedCycle;
  onOpenReport: () => void;
  onDismiss: () => void;
}) {
  const t = useT();
  return (
    <Card testID="cycle-complete-banner">
      <Text variant="heading">{t('home.cycleComplete.title', { number: completed.cycleNumber })}</Text>
      <Button label={t('home.cycleComplete.report')} onPress={onOpenReport} />
      <Button variant="secondary" label={t('home.cycleComplete.dismiss')} onPress={onDismiss} />
    </Card>
  );
}

/** Discreet reminder that no backup was made for a while (SPEC-v3 §8.1). */
export function BackupReminderCard({ onOpenSettings }: { onOpenSettings: () => void }) {
  const t = useT();
  return (
    <Card testID="backup-reminder" style={styles.card}>
      <Text tone="secondary">{t('home.backup.message')}</Text>
      <Button variant="secondary" label={t('home.backup.action')} onPress={onOpenSettings} />
    </Card>
  );
}

/** "3 weeks in a row" (SPEC-v3 §10); renders nothing below one week. */
export function StreakLine({ weeks }: { weeks: number }) {
  const t = useT();
  if (weeks < 1) return null;
  return (
    <Text tone="accent" variant="label" testID="home-streak">
      {t('home.streak', { count: weeks })}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
});
