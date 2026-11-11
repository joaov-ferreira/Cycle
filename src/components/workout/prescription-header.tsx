import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import type { EffectiveExercise } from '@/domain/program-plan';
import type { WorkoutExercise } from '@/domain/workout';
import { useI18n } from '@/i18n';
import { findProgram } from '@/library';
import { selectFindExercise, useAppStore } from '@/state';

import { Tag, useExerciseName } from '../shared';
import { Text } from '../ui';
import { MissingMaxForm } from './missing-max-form';
import { localizedText } from './program-text';

export type PrescriptionHeaderProps = {
  exercise: Pick<WorkoutExercise, 'exerciseId' | 'prescription'>;
  /** What the plan generates for this exercise in this week (program label, notes); `undefined` when the plan changed. */
  effective?: EffectiveExercise;
  index: number;
};

/**
 * What a percent exercise or program block adds above its sets (SPEC-v4 §7): where the
 * prescription comes from, the 1RM used, the program's label and notes, and the missing-1RM form.
 */
export function PrescriptionHeader({ exercise, effective, index }: PrescriptionHeaderProps) {
  const { t, locale, formatKg } = useI18n();
  const exerciseLabel = useExerciseName();
  const findExercise = useAppStore(selectFindExercise);
  const { prescription } = exercise;
  const generated = effective?.generated;

  let origin: string | null = null;
  if (prescription?.source.kind === 'program') {
    const { source } = prescription;
    const program = findProgram(source.programId)?.name ?? source.programId;
    const params = { program, week: source.programWeek, day: source.day };
    origin = source.label
      ? t('workout.rxOriginProgramLabel', { ...params, label: localizedText(source.label, locale) })
      : t('workout.rxOriginProgram', params);
  } else if (prescription?.source.kind === 'scheme') {
    origin = t('workout.rxOriginScheme', { week: prescription.source.schemeWeek });
  }

  let maxLine: string | null = null;
  if (prescription && prescription.basisKg !== null) {
    const kg = formatKg(prescription.basisKg, { minimumFractionDigits: 0 });
    const basis = prescription.basisExerciseId === exercise.exerciseId ? undefined : findExercise(prescription.basisExerciseId);
    maxLine = basis ? t('workout.rxMaxBasis', { kg, exercise: exerciseLabel(basis) }) : t('workout.rxMax', { kg });
  }

  const sourceLabel = prescription?.source.kind === 'program' ? prescription.source.label : undefined;
  const asWritten = generated?.label && !sourceLabel ? localizedText(generated.label, locale) : null;
  const missingMax = prescription?.warnings.includes('missingReferenceMax') ?? false;

  if (!origin && !maxLine && !asWritten && !generated?.note && !generated?.setNotes?.length && !missingMax) {
    return null;
  }

  return (
    <View testID={`prescription-${index}`} style={styles.container}>
      {origin ? (
        <Text variant="caption" tone="secondary">
          {origin}
        </Text>
      ) : null}
      {maxLine ? (
        <Text variant="caption" tone="secondary" tabular>
          {maxLine}
        </Text>
      ) : null}
      {asWritten ? (
        <Text variant="caption" tone="secondary">
          {t('workout.rxAsWritten', { name: asWritten })}
        </Text>
      ) : null}
      {generated?.note ? <Text>{localizedText(generated.note, locale)}</Text> : null}
      {generated?.setNotes?.map((note) => (
        <Text key={note.en} variant="caption" tone="secondary">
          {localizedText(note, locale)}
        </Text>
      ))}
      {!prescription && generated?.unverified ? <Tag label={t('common.unverified')} tone="danger" /> : null}
      {missingMax && prescription ? <MissingMaxForm basisExerciseId={prescription.basisExerciseId} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
});
