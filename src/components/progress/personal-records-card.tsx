import { Pressable, StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';
import { selectPersonalRecords } from '@/state/selectors';

import { Card, Text } from '../ui';

export type PersonalRecordsCardProps = {
  exerciseId: string;
  /** Bodyweight and band exercises: only a weight record above 0 kg is shown. */
  zeroLoad: boolean;
  onOpenWorkout?: (workoutId: number) => void;
};

type RecordRow = { key: string; value: string; date: string; workoutId: number };

/** Personal records of the selected exercise (SPEC §9.2); each row opens its workout. */
export function PersonalRecordsCard({ exerciseId, zeroLoad, onOpenWorkout }: PersonalRecordsCardProps) {
  const { t, formatKg, formatNumber, formatDate } = useI18n();
  const records = useAppStore((state) => selectPersonalRecords(state, exerciseId));

  const rows: RecordRow[] = [];
  const kg = (value: number) => formatKg(value, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  if (records.weight && records.weight.valueKg > 0) {
    rows.push({
      key: 'weight',
      value: t('progress.personalRecords.weightValue', {
        weight: kg(records.weight.valueKg),
        reps: formatNumber(records.weight.reps),
      }),
      date: formatDate(new Date(records.weight.at)),
      workoutId: records.weight.workoutId,
    });
  }
  if (!zeroLoad && records.e1rm) {
    rows.push({
      key: 'e1rm',
      value: t('progress.personalRecords.e1rmValue', { value: kg(records.e1rm.valueKg) }),
      date: formatDate(new Date(records.e1rm.at)),
      workoutId: records.e1rm.workoutId,
    });
  }

  return (
    <Card testID="personal-records">
      <Text variant="heading">{t('progress.personalRecords.title')}</Text>
      {rows.length === 0 ? (
        <Text tone="secondary">{t('progress.personalRecords.empty')}</Text>
      ) : (
        rows.map((row) => {
          const content = (
            <View style={styles.row}>
              <Text variant="label" tabular>
                {row.value}
              </Text>
              <Text variant="caption" tone="secondary">
                {row.date}
              </Text>
            </View>
          );
          if (!onOpenWorkout) return <View key={row.key}>{content}</View>;
          return (
            <Pressable
              key={row.key}
              accessibilityRole="button"
              accessibilityLabel={t('progress.personalRecords.rowLabel', { value: row.value, date: row.date })}
              onPress={() => onOpenWorkout(row.workoutId)}
              style={styles.pressable}>
              {content}
            </Pressable>
          );
        })
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  pressable: { minHeight: 44, justifyContent: 'center' },
  row: { gap: spacing.xs / 2, paddingVertical: spacing.xs, minHeight: 44, justifyContent: 'center' },
});
