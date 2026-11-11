import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';
import { selectAllExercises } from '@/state/selectors';

import { Chip, EmptyState, ExercisePicker, equipmentLabelKey, exerciseName, muscleLabelKey } from '../shared';
import { useTheme } from '../theme-provider';
import { Button, Text } from '../ui';

export type ExercisesScreenProps = {
  onOpenExercise: (id: string) => void;
  /** `name` is the text typed in the search when the picker's create action is used. */
  onNewExercise: (name?: string) => void;
  onBack?: () => void;
};

/** Exercises list (SPEC §2.4): searchable, filterable, with custom exercises and archived ones. */
export function ExercisesScreen({ onOpenExercise, onNewExercise, onBack }: ExercisesScreenProps) {
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const all = useAppStore(selectAllExercises);
  const [showArchived, setShowArchived] = useState(false);

  const archived = useMemo(() => all.filter((exercise) => exercise.custom && exercise.archived), [all]);
  const active = useMemo(() => all.filter((exercise) => !exercise.archived), [all]);

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.root, { backgroundColor: colors.background }]}
      testID="screen-exercises">
      <View style={styles.top}>
        <Text variant="title">{t('exercises.title')}</Text>
        <View style={styles.actions}>
          {onBack ? <Button variant="secondary" label={t('common.back')} onPress={onBack} /> : null}
          <Button label={t('exercises.newButton')} onPress={() => onNewExercise()} />
          <Chip
            label={showArchived ? t('exercises.hideArchived') : t('exercises.showArchived')}
            selected={showArchived}
            onPress={() => setShowArchived((current) => !current)}
          />
        </View>
      </View>
      {showArchived ? (
        <ScrollView contentContainerStyle={styles.archived}>
          <Text variant="heading">{t('exercises.archivedTitle')}</Text>
          {archived.length === 0 ? (
            <EmptyState title={t('exercises.archivedEmpty')} />
          ) : (
            archived.map((exercise) => {
              const subtitle = t('picker.rowSubtitle', {
                muscle: t(muscleLabelKey(exercise.primaryMuscle)),
                equipment: t(equipmentLabelKey(exercise.equipment)),
              });
              const name = exerciseName(exercise, locale);
              return (
                <Pressable
                  key={exercise.id}
                  accessibilityRole="button"
                  accessibilityLabel={name}
                  accessibilityHint={subtitle}
                  onPress={() => onOpenExercise(exercise.id)}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    pressed && styles.pressed,
                  ]}>
                  <View style={styles.rowText}>
                    <Text variant="label">{name}</Text>
                    <Text variant="caption" tone="secondary">
                      {subtitle}
                    </Text>
                  </View>
                  <Text variant="caption" tone="accent">
                    {t('exercises.archivedBadge')}
                  </Text>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      ) : (
        <ExercisePicker
          exercises={active}
          onSelect={(exercise) => onOpenExercise(exercise.id)}
          onCreateNew={(query) => onNewExercise(query === '' ? undefined : query)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  archived: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  rowText: { flex: 1, gap: spacing.xs },
  pressed: { opacity: 0.6 },
});
