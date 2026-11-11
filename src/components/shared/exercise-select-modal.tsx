import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import type { CustomExerciseInput, Exercise } from '@/domain/exercise';
import type { CustomExerciseErrors } from '@/domain/exercise-match';
import { useT } from '@/i18n';

import { useTheme } from '../theme-provider';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { CustomExerciseForm } from './custom-exercise-form';
import { ExercisePicker } from './exercise-picker';

export type ExerciseSelectModalProps = {
  visible: boolean;
  /** Title of the picker screen. */
  title: string;
  exercises: readonly Exercise[];
  suggested?: readonly Exercise[];
  excludeIds?: readonly string[];
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
  /**
   * Creates a custom exercise. Enables the picker's create action; the new exercise is passed to
   * `onSelect`. A rejection carrying `errors` (`CustomExerciseErrors`) is shown in the form.
   */
  onCreateExercise?: (input: CustomExerciseInput) => Promise<Exercise>;
  testID?: string;
};

/** The validation codes of a rejected creation, when the rejection carries them. */
function errorsOf(error: unknown): CustomExerciseErrors | undefined {
  if (typeof error === 'object' && error !== null && 'errors' in error) {
    return (error as { errors: CustomExerciseErrors }).errors;
  }
  return undefined;
}

/**
 * Full-screen exercise chooser: the picker, plus (when `onCreateExercise` is given) a form to
 * create a custom exercise named after the search text. Nothing is mounted while hidden, so every
 * opening starts from the picker.
 */
export function ExerciseSelectModal(props: ExerciseSelectModalProps) {
  if (!props.visible) return null;
  return <SelectFlow {...props} />;
}

function SelectFlow({
  title,
  exercises,
  suggested,
  excludeIds,
  onSelect,
  onClose,
  onCreateExercise,
  testID,
}: Omit<ExerciseSelectModalProps, 'visible'>) {
  const { colors } = useTheme();
  const t = useT();
  const [creating, setCreating] = useState(false);
  const [seed, setSeed] = useState('');
  const [errors, setErrors] = useState<CustomExerciseErrors | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const backToPicker = () => {
    setCreating(false);
    setErrors(undefined);
    setBusy(false);
  };

  const close = () => {
    backToPicker();
    onClose();
  };

  const create = async (input: CustomExerciseInput) => {
    if (!onCreateExercise) return;
    setBusy(true);
    setErrors(undefined);
    try {
      const exercise = await onCreateExercise(input);
      backToPicker();
      onSelect(exercise);
    } catch (error) {
      setBusy(false);
      setErrors(errorsOf(error));
    }
  };

  const showing = creating && onCreateExercise ? t('picker.createNew') : title;

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => (creating ? backToPicker() : close())}>
      <View testID={testID} style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.bar}>
          <Text variant="heading" style={styles.title}>
            {showing}
          </Text>
          <Button variant="secondary" label={t('common.close')} onPress={close} />
        </View>
        {creating && onCreateExercise ? (
          <CustomExerciseForm
            initial={{ name: seed }}
            errors={errors}
            busy={busy}
            submitLabel={t('picker.createSubmit')}
            onSubmit={create}
            onCancel={backToPicker}
          />
        ) : (
          <ExercisePicker
            exercises={exercises}
            suggested={suggested}
            excludeIds={excludeIds}
            onSelect={onSelect}
            onCreateNew={
              onCreateExercise
                ? (query) => {
                    setSeed(query);
                    setErrors(undefined);
                    setCreating(true);
                  }
                : undefined
            }
          />
        )}
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
