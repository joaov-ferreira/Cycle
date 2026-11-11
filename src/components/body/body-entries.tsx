import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';
import type { BodyMetric, BodyMetricKind } from '@/domain/body';
import { useI18n } from '@/i18n';

import { EmptyState } from '../shared/empty-state';
import { Button, Text } from '../ui';
import { KIND_KEYS, formatMetric, localDay } from './metric-format';

export type BodyEntriesProps = {
  kind: BodyMetricKind;
  /** The entries of the kind, newest first. */
  entries: readonly BodyMetric[];
  onEdit: (entry: BodyMetric) => void;
  onDelete: (entry: BodyMetric) => void;
};

/** The entries of one kind: a tap loads one into the form, Delete asks for confirmation first. */
export function BodyEntries({ kind, entries, onEdit, onDelete }: BodyEntriesProps) {
  const i18n = useI18n();
  const { t, formatDate } = i18n;

  return (
    <View testID="body-entries" style={styles.list}>
      <Text variant="heading">{t('body.entries.title')}</Text>
      {entries.length === 0 ? (
        <EmptyState
          title={t('body.empty.title')}
          message={t('body.empty.message', { kind: t(KIND_KEYS[kind]) })}
          testID="body-empty"
        />
      ) : (
        entries.map((entry) => {
          const date = formatDate(localDay(entry.date));
          const value = formatMetric(i18n, kind, entry.value);
          return (
            <View key={entry.id} style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('body.entries.edit', { date, value })}
                onPress={() => onEdit(entry)}
                style={styles.entry}>
                <Text variant="label">{date}</Text>
                <Text tabular>{value}</Text>
              </Pressable>
              <Button
                variant="secondary"
                label={t('common.delete')}
                accessibilityLabel={t('body.entries.delete', { date })}
                onPress={() => onDelete(entry)}
              />
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  entry: {
    flex: 1,
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
});
