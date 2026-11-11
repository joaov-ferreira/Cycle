import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import {
  CUSTOM_EXERCISE_NAME,
  EQUIPMENT,
  MUSCLE_GROUPS,
  type CustomExerciseInput,
  type Equipment,
  type Mechanics,
  type MuscleGroup,
} from '@/domain/exercise';
import type { CustomExerciseErrors } from '@/domain/exercise-match';
import { useT, type MessageKey, type TFunction } from '@/i18n';

import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Text } from '../ui/Text';
import { TextField } from '../ui/TextField';
import { Chip } from './chip';
import { equipmentLabelKey, muscleLabelKey } from './labels';

export type CustomExerciseFormProps = {
  /** Starting values, e.g. a name typed in the picker. */
  initial?: Partial<CustomExerciseInput>;
  /** Error codes from `validateCustomExercise`, shown next to their fields. */
  errors?: CustomExerciseErrors;
  submitLabel: string;
  onSubmit: (input: CustomExerciseInput) => void;
  /** Shows a cancel action when given. */
  onCancel?: () => void;
  /** Disables the form actions while the exercise is being saved. */
  busy?: boolean;
  testID?: string;
};

/** Localized message key of every error code of `CustomExerciseErrors`. */
const EXERCISE_ERROR_KEYS: {
  [F in keyof CustomExerciseErrors]-?: Record<NonNullable<CustomExerciseErrors[F]>, MessageKey>;
} = {
  name: {
    required: 'common.exerciseErrors.name.required',
    tooLong: 'common.exerciseErrors.name.tooLong',
    duplicateName: 'common.exerciseErrors.name.duplicateName',
  },
  primaryMuscle: { invalidMuscle: 'common.exerciseErrors.primaryMuscle.invalidMuscle' },
  equipment: { invalidEquipment: 'common.exerciseErrors.equipment.invalidEquipment' },
  mechanics: { invalidMechanics: 'common.exerciseErrors.mechanics.invalidMechanics' },
  secondaryMuscles: {
    invalidSecondaryMuscles: 'common.exerciseErrors.secondaryMuscles.invalidSecondaryMuscles',
  },
};

function errorMessage(t: TFunction, field: keyof CustomExerciseErrors, code: string): string {
  const key = (EXERCISE_ERROR_KEYS[field] as Record<string, MessageKey>)[code];
  return t(key, { max: CUSTOM_EXERCISE_NAME.max });
}

/**
 * Create or edit a custom exercise (SPEC §2.3): name, primary muscle, equipment, mechanics and
 * secondary muscles. Submit stays disabled until name, primary muscle and equipment are set.
 */
export function CustomExerciseForm({
  initial,
  errors,
  submitLabel,
  onSubmit,
  onCancel,
  busy = false,
  testID,
}: CustomExerciseFormProps) {
  const t = useT();
  const [name, setName] = useState(initial?.name ?? '');
  const [primary, setPrimary] = useState<MuscleGroup | null>(initial?.primaryMuscle ?? null);
  const [equipment, setEquipment] = useState<Equipment | null>(initial?.equipment ?? null);
  const [mechanics, setMechanics] = useState<Mechanics>(initial?.mechanics ?? 'compound');
  const [secondary, setSecondary] = useState<MuscleGroup[]>(initial?.secondaryMuscles ?? []);

  const trimmed = name.trim();
  const canSubmit = trimmed !== '' && primary !== null && equipment !== null && !busy;
  const choosePrimary = (muscle: MuscleGroup) => {
    setPrimary(muscle);
    setSecondary((current) => current.filter((item) => item !== muscle));
  };
  const toggleSecondary = (muscle: MuscleGroup) => {
    setSecondary((current) =>
      current.includes(muscle) ? current.filter((item) => item !== muscle) : [...current, muscle],
    );
  };

  const nameError = errors?.name ? errorMessage(t, 'name', errors.name) : null;
  const primaryError = errors?.primaryMuscle
    ? errorMessage(t, 'primaryMuscle', errors.primaryMuscle)
    : null;
  const equipmentError = errors?.equipment ? errorMessage(t, 'equipment', errors.equipment) : null;
  const mechanicsError = errors?.mechanics ? errorMessage(t, 'mechanics', errors.mechanics) : null;
  const secondaryError = errors?.secondaryMuscles
    ? errorMessage(t, 'secondaryMuscles', errors.secondaryMuscles)
    : null;

  return (
    <ScrollView
      testID={testID}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}>
      <TextField
        label={t('picker.formName')}
        value={name}
        onChangeText={setName}
        error={nameError}
      />

      <View style={styles.section}>
        <Text variant="label">{t('picker.formPrimaryMuscle')}</Text>
        <View style={styles.chips}>
          {MUSCLE_GROUPS.map((muscle) => (
            <Chip
              key={muscle}
              testID={`form-primary-${muscle}`}
              label={t(muscleLabelKey(muscle))}
              selected={primary === muscle}
              onPress={() => choosePrimary(muscle)}
            />
          ))}
        </View>
        {primaryError ? <Text variant="caption" tone="danger">{primaryError}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text variant="label">{t('picker.formEquipment')}</Text>
        <View style={styles.chips}>
          {EQUIPMENT.map((value) => (
            <Chip
              key={value}
              testID={`form-equipment-${value}`}
              label={t(equipmentLabelKey(value))}
              selected={equipment === value}
              onPress={() => setEquipment(value)}
            />
          ))}
        </View>
        {equipmentError ? <Text variant="caption" tone="danger">{equipmentError}</Text> : null}
      </View>

      <View style={styles.section}>
        <SegmentedControl
          label={t('picker.formMechanics')}
          value={mechanics}
          onChange={setMechanics}
          options={[
            { value: 'compound', label: t('common.mechanics.compound') },
            { value: 'isolation', label: t('common.mechanics.isolation') },
          ]}
        />
        {mechanicsError ? <Text variant="caption" tone="danger">{mechanicsError}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text variant="label">{t('picker.formSecondaryMuscles')}</Text>
        <View style={styles.chips}>
          {MUSCLE_GROUPS.filter((muscle) => muscle !== primary).map((muscle) => (
            <Chip
              key={muscle}
              testID={`form-secondary-${muscle}`}
              label={t(muscleLabelKey(muscle))}
              selected={secondary.includes(muscle)}
              onPress={() => toggleSecondary(muscle)}
            />
          ))}
        </View>
        {secondaryError ? <Text variant="caption" tone="danger">{secondaryError}</Text> : null}
      </View>

      <View style={styles.actions}>
        {onCancel ? (
          <Button variant="secondary" label={t('common.cancel')} onPress={onCancel} disabled={busy} />
        ) : null}
        <Button
          label={submitLabel}
          disabled={!canSubmit}
          onPress={() => {
            if (!primary || !equipment) return;
            onSubmit({
              name: trimmed,
              primaryMuscle: primary,
              equipment,
              mechanics,
              secondaryMuscles: MUSCLE_GROUPS.filter((muscle) => secondary.includes(muscle)),
            });
          }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.xl },
  section: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
