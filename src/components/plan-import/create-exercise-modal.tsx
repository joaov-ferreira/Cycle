import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import type { CustomExerciseInput, Exercise } from '@/domain/exercise';
import { validateCustomExercise, type CustomExerciseErrors } from '@/domain/exercise-match';
import { useT } from '@/i18n';

import { CustomExerciseForm } from '../shared';
import { useTheme } from '../theme-provider';
import { Button, Text } from '../ui';

export type CreateExerciseModalProps = {
  visible: boolean;
  /** Name the form starts with (the unresolved name from the import). */
  name: string;
  /** Starting values when changing an earlier choice. */
  initial?: CustomExerciseInput;
  /** Every exercise a new name must not collide with: the library, plus other pending creations. */
  others: readonly Exercise[];
  /** Receives the validated input; nothing is created until the plan is saved. */
  onSubmit: (input: CustomExerciseInput) => void;
  onClose: () => void;
};

/** The shared custom-exercise form in a full-screen modal, validated locally (no store write). */
export function CreateExerciseModal({ visible, name, initial, others, onSubmit, onClose }: CreateExerciseModalProps) {
  const { colors } = useTheme();
  const t = useT();
  const [errors, setErrors] = useState<CustomExerciseErrors | undefined>(undefined);

  if (!visible) return null;

  const close = () => {
    setErrors(undefined);
    onClose();
  };

  const submit = (input: CustomExerciseInput) => {
    const found = validateCustomExercise(input, others);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setErrors(undefined);
    onSubmit(input);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <View testID="create-exercise-modal" style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.bar}>
          <Text variant="heading" style={styles.title}>
            {t('planImport.preview.createTitle')}
          </Text>
          <Button variant="secondary" label={t('common.close')} onPress={close} />
        </View>
        <CustomExerciseForm
          initial={initial ?? { name }}
          errors={errors}
          submitLabel={t('planImport.preview.createSubmit')}
          onSubmit={submit}
          onCancel={close}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  title: { flex: 1 },
});
