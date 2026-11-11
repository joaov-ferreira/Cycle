import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';
import {
  EQUIPMENT,
  MUSCLE_GROUPS,
  type Equipment,
  type Exercise,
  type MuscleGroup,
} from '@/domain/exercise';
import { searchExercises } from '@/domain/exercise-match';
import { useI18n } from '@/i18n';

import { useTheme } from '../theme-provider';
import { TextField } from '../ui/TextField';
import { Text } from '../ui/Text';
import { EmptyState } from './empty-state';
import { FilterChips, type FilterOption } from './filter-chips';
import { equipmentLabelKey, exerciseName, muscleLabelKey } from './labels';

export type ExercisePickerProps = {
  exercises: readonly Exercise[];
  onSelect: (exercise: Exercise) => void;
  /** Offers to create an exercise named after the search text (may be empty). */
  onCreateNew?: (query: string) => void;
  /** Shown first under a "Suggestions" heading, when given. */
  suggested?: readonly Exercise[];
  /** Exercise ids that must not be offered (e.g. already in the workout). */
  excludeIds?: readonly string[];
  testID?: string;
};

type ListItem =
  | { kind: 'heading'; key: string; title: string }
  | { kind: 'exercise'; key: string; exercise: Exercise };

/**
 * Searchable exercise list (SPEC §2.4, §7.3): text search over both languages and aliases,
 * muscle-group and equipment filters, suggestions, and a create action for missing names.
 * Archived exercises are never shown.
 */
export function ExercisePicker({
  exercises,
  onSelect,
  onCreateNew,
  suggested,
  excludeIds,
  testID,
}: ExercisePickerProps) {
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);

  const muscleOptions = useMemo<FilterOption<MuscleGroup>[]>(
    () => MUSCLE_GROUPS.map((value) => ({ value, label: t(muscleLabelKey(value)) })),
    [t],
  );
  const equipmentOptions = useMemo<FilterOption<Equipment>[]>(
    () => EQUIPMENT.map((value) => ({ value, label: t(equipmentLabelKey(value)) })),
    [t],
  );

  const items = useMemo<ListItem[]>(() => {
    const excluded = new Set(excludeIds ?? []);
    const filters = { muscle: muscle ?? undefined, equipment: equipment ?? undefined };
    const shown = searchExercises(
      (suggested ?? []).filter((exercise) => !excluded.has(exercise.id)),
      query,
      filters,
    );
    const shownIds = new Set(shown.map((exercise) => exercise.id));
    const rest = searchExercises(
      exercises.filter((exercise) => !excluded.has(exercise.id) && !shownIds.has(exercise.id)),
      query,
      filters,
    );
    const list: ListItem[] = [];
    const push = (section: Exercise[], heading: string | null) => {
      if (section.length === 0) return;
      if (heading) list.push({ kind: 'heading', key: `heading-${heading}`, title: heading });
      for (const exercise of section) {
        list.push({ kind: 'exercise', key: exercise.id, exercise });
      }
    };
    push(shown, t('picker.suggestions'));
    push(rest, shown.length > 0 ? t('picker.results') : null);
    return list;
  }, [exercises, suggested, excludeIds, query, muscle, equipment, t]);

  const trimmed = query.trim();

  const header = (
    <View style={styles.header}>
      <TextField
        label={t('picker.searchLabel')}
        value={query}
        onChangeText={setQuery}
        testID="picker-search"
      />
      <Text variant="label" tone="secondary">
        {t('picker.muscleFilter')}
      </Text>
      <FilterChips
        options={muscleOptions}
        value={muscle}
        onChange={setMuscle}
        allLabel={t('common.all')}
        testID="picker-muscle-filter"
      />
      <Text variant="label" tone="secondary">
        {t('picker.equipmentFilter')}
      </Text>
      <FilterChips
        options={equipmentOptions}
        value={equipment}
        onChange={setEquipment}
        allLabel={t('common.all')}
        testID="picker-equipment-filter"
      />
    </View>
  );

  const empty = (
    <EmptyState
      title={t('picker.emptyTitle')}
      message={t('picker.emptyMessage')}
      actionLabel={
        onCreateNew
          ? trimmed
            ? t('picker.createExercise', { name: trimmed })
            : t('picker.createNew')
          : undefined
      }
      onAction={onCreateNew ? () => onCreateNew(trimmed) : undefined}
    />
  );

  return (
    <FlatList
      testID={testID}
      data={items}
      keyExtractor={(item) => item.key}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      renderItem={({ item }) => {
        if (item.kind === 'heading') {
          return (
            <Text
              variant="label"
              tone="secondary"
              accessibilityRole="header"
              style={styles.heading}>
              {item.title}
            </Text>
          );
        }
        const { exercise } = item;
        const name = exerciseName(exercise, locale);
        const subtitle = t('picker.rowSubtitle', {
          muscle: t(muscleLabelKey(exercise.primaryMuscle)),
          equipment: t(equipmentLabelKey(exercise.equipment)),
        });
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={name}
            accessibilityHint={subtitle}
            onPress={() => onSelect(exercise)}
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
            {exercise.custom ? (
              <View style={[styles.badge, { borderColor: colors.accentText }]}>
                <Text variant="caption" tone="accent">
                  {t('common.custom')}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.sm },
  header: { gap: spacing.sm, paddingBottom: spacing.sm },
  heading: { marginTop: spacing.md },
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
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
  },
  pressed: { opacity: 0.6 },
});
