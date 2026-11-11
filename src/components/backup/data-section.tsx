import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import type { BackupSummary } from '@/domain/backup';
import { useI18n, type MessageKey } from '@/i18n';
import { saveAndShareFile, type SaveableFile } from '@/platform/save-file';
import { BACKUP_MAX_BYTES, pickBackupFile, type PickedBackupFile } from '@/platform/pick-backup-file';
import { selectBackupReminder } from '@/state/selectors-v3';
import { useAppStore } from '@/state/app-store-context';
import { BackupParseError, InvalidProfileNameError } from '@/state/errors';

import { Button, Card, Text } from '../ui';
import { restoredProfileName } from './restored-name';

export type DataSectionProps = {
  /** Saves and shares a file; resolves false on failure. Default: the platform adapter. */
  saveFile?: (file: SaveableFile) => Promise<boolean>;
  /** Lets the user pick a backup file; null when cancelled. Default: the document picker. */
  pickFile?: () => Promise<PickedBackupFile | null>;
  /** The clock for the backup reminder. Default: the system clock. */
  now?: () => Date;
};

type Notice = { tone: 'info' | 'error'; text: string };
type Pending = { text: string; summary: BackupSummary };

/** Settings → Data (SPEC-v3 §8): backup export, restore into a new profile, CSV export. */
export function DataSection({
  saveFile = saveAndShareFile,
  pickFile = pickBackupFile,
  now = () => new Date(),
}: DataSectionProps) {
  const { t, formatDate, formatNumber } = useI18n();
  const settings = useAppStore((s) => s.settings);
  const profiles = useAppStore((s) => s.profiles);
  const hasWorkouts = useAppStore((s) => s.workouts.length > 0);
  const reminder = useAppStore((s) => selectBackupReminder(s, now()));
  const buildBackupFile = useAppStore((s) => s.buildBackupFile);
  const markBackupDone = useAppStore((s) => s.markBackupDone);
  const previewBackup = useAppStore((s) => s.previewBackup);
  const restoreBackup = useAppStore((s) => s.restoreBackup);
  const buildLogbookCsv = useAppStore((s) => s.buildLogbookCsv);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  if (!settings) return null;

  const info = (text: string) => setNotice({ tone: 'info', text });
  const fail = (text: string) => setNotice({ tone: 'error', text });

  const parseErrorMessage = (error: BackupParseError): string => {
    const first = error.errors[0];
    switch (first?.code) {
      case 'invalidJson':
        return t('backup.errors.invalidJson');
      case 'notAnObject':
        return t('backup.errors.notAnObject');
      case 'unsupportedFormat':
        return t('backup.errors.unsupportedFormat');
      case 'unsupportedVersion':
        return t('backup.errors.unsupportedVersion');
      case 'invalidBackup':
        return first.path
          ? t('backup.errors.invalidBackup', { path: first.path })
          : t('backup.errors.invalidBackupNoPath');
      default:
        return t('backup.errors.generic');
    }
  };

  const exportBackup = async () => {
    setNotice(null);
    setBusy(true);
    try {
      const file = await buildBackupFile();
      const saved = await saveFile({ fileName: file.fileName, text: file.text, mimeType: 'application/json' });
      if (!saved) return fail(t('backup.exportFailed'));
      await markBackupDone();
      info(t('backup.exportDone'));
    } catch {
      fail(t('backup.exportFailed'));
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    setNotice(null);
    setBusy(true);
    try {
      const file = buildLogbookCsv();
      const saved = await saveFile({ fileName: file.fileName, text: file.text, mimeType: 'text/csv' });
      if (saved) info(t('backup.csvDone'));
      else fail(t('backup.csvFailed'));
    } catch {
      fail(t('backup.csvFailed'));
    } finally {
      setBusy(false);
    }
  };

  const chooseFile = async () => {
    setNotice(null);
    setPending(null);
    try {
      const picked = await pickFile();
      if (!picked) return;
      if (picked.size > BACKUP_MAX_BYTES) return fail(t('backup.fileTooLarge'));
      setPending({ text: picked.text, summary: previewBackup(picked.text) });
    } catch (e) {
      fail(e instanceof BackupParseError ? parseErrorMessage(e) : t('backup.errors.generic'));
    }
  };

  const confirmRestore = async () => {
    if (!pending) return;
    const { text, summary } = pending;
    setPending(null);
    setBusy(true);
    try {
      const name = restoredProfileName(
        summary.profileName,
        (original) => t('backup.restoredName', { name: original }),
        profiles.map((p) => p.name),
      );
      const profile = await restoreBackup(text, name);
      info(t('backup.restored', { name: profile.name }));
    } catch (e) {
      if (e instanceof BackupParseError) fail(parseErrorMessage(e));
      else if (e instanceof InvalidProfileNameError) fail(t('backup.errors.profileName'));
      else fail(t('backup.errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const date = (iso: string): string => {
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? iso : formatDate(parsed);
  };
  const count = (key: MessageKey, value: number) => t(key, { count: formatNumber(value) });

  return (
    <Card>
      <Text variant="heading">{t('backup.title')}</Text>
      <Text tone="secondary">
        {settings.lastBackupAt
          ? t('backup.lastBackup', { date: date(settings.lastBackupAt) })
          : t('backup.noBackup')}
      </Text>
      {reminder ? (
        <Text tone="secondary" variant="caption">
          {t('backup.reminder')}
        </Text>
      ) : null}

      <Button variant="secondary" label={t('backup.export')} onPress={exportBackup} disabled={busy} />
      <Button variant="secondary" label={t('backup.restore')} onPress={chooseFile} disabled={busy} />
      <Button
        variant="secondary"
        label={t('backup.csv')}
        onPress={exportCsv}
        disabled={busy || !hasWorkouts}
        hint={hasWorkouts ? undefined : t('backup.csvEmpty')}
      />
      {hasWorkouts ? null : (
        <Text tone="secondary" variant="caption">
          {t('backup.csvEmpty')}
        </Text>
      )}

      {pending ? (
        <View style={styles.summary} testID="restore-summary">
          <Text variant="heading">{t('backup.restoreTitle')}</Text>
          <Text>{t('backup.summary.profile', { name: pending.summary.profileName })}</Text>
          <Text>{t('backup.summary.exportedAt', { date: date(pending.summary.exportedAt) })}</Text>
          <Text>{count('backup.summary.plans', pending.summary.plans)}</Text>
          <Text>{count('backup.summary.workouts', pending.summary.workouts)}</Text>
          <Text>{count('backup.summary.customExercises', pending.summary.customExercises)}</Text>
          <Text>{count('backup.summary.bodyMetrics', pending.summary.bodyMetrics)}</Text>
          {pending.summary.firstWorkoutAt ? (
            <Text>{t('backup.summary.firstWorkout', { date: date(pending.summary.firstWorkoutAt) })}</Text>
          ) : null}
          {pending.summary.lastWorkoutAt ? (
            <Text>{t('backup.summary.lastWorkout', { date: date(pending.summary.lastWorkoutAt) })}</Text>
          ) : null}
          <Text tone="secondary">{t('backup.summary.newProfile')}</Text>
          <Button label={t('backup.confirmRestore')} onPress={confirmRestore} />
          <Button variant="secondary" label={t('common.cancel')} onPress={() => setPending(null)} />
        </View>
      ) : null}

      {notice ? (
        <Text
          tone={notice.tone === 'error' ? 'danger' : 'secondary'}
          accessibilityRole={notice.tone === 'error' ? 'alert' : undefined}
          accessibilityLiveRegion="polite">
          {notice.text}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  summary: { gap: spacing.sm },
});
