/**
 * Display labels for exercise fields. Components never hard-code these: they ask for the i18n
 * key and render it with `t()` (or read the name in the UI locale).
 */
import { useCallback } from 'react';

import type { Equipment, Exercise, Mechanics, MuscleGroup } from '@/domain/exercise';
import { useI18n, type AppLocale, type MessageKey } from '@/i18n';

/** The exercise's name in the given UI locale (custom exercises store the same text in both). */
export function exerciseName(exercise: Pick<Exercise, 'name'>, locale: AppLocale): string {
  return exercise.name[locale];
}

/** Name of an exercise in the current UI locale. */
export function useExerciseName(): (exercise: Pick<Exercise, 'name'>) => string {
  const { locale } = useI18n();
  return useCallback((exercise) => exerciseName(exercise, locale), [locale]);
}

export function muscleLabelKey(muscle: MuscleGroup): MessageKey {
  return `common.muscles.${muscle}`;
}

export function equipmentLabelKey(equipment: Equipment): MessageKey {
  return `common.equipment.${equipment}`;
}

export function mechanicsLabelKey(mechanics: Mechanics): MessageKey {
  return `common.mechanics.${mechanics}`;
}
