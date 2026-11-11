import { StyleSheet } from 'react-native';

import { spacing } from '@/constants/theme';
import { useI18n, useT } from '@/i18n';
import { selectFindExercise, useAppStore } from '@/state';
import type { CompletedCycle } from '@/state/types';

import { useExerciseName } from '../shared';
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

/** The exercises of the active plan that miss a reference 1RM, with the way to set them (SPEC-v4 §10.7). */
export function MissingMaxesNotice({ exerciseIds, onOpenMaxes }: { exerciseIds: readonly string[]; onOpenMaxes: () => void }) {
  const { t } = useI18n();
  const nameOf = useExerciseName();
  const find = useAppStore(selectFindExercise);
  const names = exerciseIds.map((id) => {
    const exercise = find(id);
    return exercise ? nameOf(exercise) : id;
  });
  return (
    <Card testID="missing-maxes-notice" style={styles.card}>
      <Text variant="heading">{t('home.missingMaxes.title')}</Text>
      <Text tone="secondary">{t('home.missingMaxes.message', { names: names.join(', ') })}</Text>
      <Button variant="secondary" label={t('home.missingMaxes.action')} onPress={onOpenMaxes} />
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
