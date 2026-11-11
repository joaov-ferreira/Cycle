import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { selectAllExercises, selectCurrentMaxes, selectExercisesWithMax } from '@/state';
import { useAppStore } from '@/state/app-store-context';

import { EmptyState, ExerciseSelectModal, exerciseName } from '../shared';
import { useTheme } from '../theme-provider';
import { Button, Card, Screen, Text } from '../ui';
import { EstimateOffer } from './estimate-offer';

export type MaxesScreenProps = {
  /** Opens the 1RM detail of an exercise (a row, or the exercise picked with "Add exercise"). */
  onOpenExercise: (exerciseId: string) => void;
  onOpenCalculator?: () => void;
  onBack?: () => void;
};

/**
 * 1RMs (SPEC-v4 §10.5): the exercises with a reference 1RM with its value and date, the latest
 * strength estimate with a "Use" action when it is higher, and "Add exercise".
 */
export function MaxesScreen({ onOpenExercise, onOpenCalculator, onBack }: MaxesScreenProps) {
  const { t, locale, formatKg, formatDate } = useI18n();
  const { colors } = useTheme();
  const exerciseIds = useAppStore(selectExercisesWithMax);
  const current = useAppStore(selectCurrentMaxes);
  const allExercises = useAppStore(selectAllExercises);
  const [picking, setPicking] = useState(false);

  const pickable = useMemo(() => allExercises.filter((e) => !e.archived), [allExercises]);
  const byId = useMemo(() => new Map(allExercises.map((e) => [e.id, e])), [allExercises]);

  return (
    <Screen title={t('maxes.title')} testID="screen-maxes">
      {onBack ? <Button variant="secondary" label={t('common.back')} onPress={onBack} /> : null}

      {exerciseIds.length === 0 ? (
        <EmptyState title={t('maxes.list.emptyTitle')} message={t('maxes.list.emptyMessage')} />
      ) : (
        exerciseIds.map((exerciseId) => {
          const max = current[exerciseId];
          const exercise = byId.get(exerciseId);
          if (!max) return null;
          const name = exercise ? exerciseName(exercise, locale) : exerciseId;
          const value = formatKg(max.kg);
          const date = formatDate(new Date(max.effectiveAt));
          return (
            <Card key={exerciseId} testID={`max-row-${exerciseId}`}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('maxes.list.rowLabel', { name, value, date })}
                onPress={() => onOpenExercise(exerciseId)}
                style={styles.row}>
                <View style={styles.rowText}>
                  <Text variant="heading">{name}</Text>
                  <Text variant="caption" tone="secondary">
                    {t('maxes.list.since', { date })}
                  </Text>
                </View>
                <Text variant="heading" style={{ color: colors.accentText }}>
                  {value}
                </Text>
              </Pressable>
              <EstimateOffer exerciseId={exerciseId} name={name} currentKg={max.kg} />
            </Card>
          );
        })
      )}

      <Button label={t('maxes.list.add')} onPress={() => setPicking(true)} />
      {onOpenCalculator ? (
        <Button variant="secondary" label={t('maxes.calculatorLink')} onPress={onOpenCalculator} />
      ) : null}

      <ExerciseSelectModal
        visible={picking}
        title={t('maxes.list.pickerTitle')}
        exercises={pickable}
        onSelect={(exercise) => {
          setPicking(false);
          onOpenExercise(exercise.id);
        }}
        onClose={() => setPicking(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radius.md,
  },
  rowText: { flex: 1, gap: spacing.xs },
});
