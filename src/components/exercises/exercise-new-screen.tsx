import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, spacing } from '@/constants/theme';
import type { CustomExerciseInput, Exercise } from '@/domain/exercise';
import type { CustomExerciseErrors } from '@/domain/exercise-match';
import { useT } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';
import { CustomExerciseValidationError } from '@/state/errors';

import { CustomExerciseForm } from '../shared';
import { useTheme } from '../theme-provider';
import { Text } from '../ui';

export type ExerciseNewScreenProps = {
  /** Prefills the name, e.g. the text typed in the exercises search. */
  initialName?: string;
  onCreated: (exercise: Exercise) => void;
  onCancel: () => void;
};

/** New custom exercise (SPEC §2.3): the shared form over `createCustomExercise`. */
export function ExerciseNewScreen({ initialName, onCreated, onCancel }: ExerciseNewScreenProps) {
  const { colors } = useTheme();
  const t = useT();
  const createCustomExercise = useAppStore((s) => s.createCustomExercise);
  const [errors, setErrors] = useState<CustomExerciseErrors | undefined>();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (input: CustomExerciseInput) => {
    setBusy(true);
    setFailed(false);
    try {
      const created = await createCustomExercise(input);
      setErrors(undefined);
      onCreated(created);
    } catch (error) {
      if (error instanceof CustomExerciseValidationError) {
        setErrors(error.errors);
      } else {
        setErrors(undefined);
        setFailed(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.root, { backgroundColor: colors.background }]}
      testID="screen-exercise-new">
      <View style={styles.top}>
        <Text variant="title">{t('exercises.newTitle')}</Text>
        {failed ? (
          <Text tone="danger" accessibilityRole="alert">
            {t('exercises.saveFailed')}
          </Text>
        ) : null}
      </View>
      <CustomExerciseForm
        initial={initialName ? { name: initialName } : undefined}
        errors={errors}
        submitLabel={t('exercises.createSubmit')}
        onSubmit={submit}
        onCancel={onCancel}
        busy={busy}
      />
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
});
