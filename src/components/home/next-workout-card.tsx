import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/constants/theme';
import { programWeekFor } from '@/domain/percent-scheme';
import { useI18n } from '@/i18n';
import { findProgram } from '@/library';
import { selectFindExercise, useAppStore, type NextPlanWorkout } from '@/state';

import { useStrengthFormat, type StrengthFormat } from '../progress/strength-format';
import { useExerciseName } from '../shared';
import { useTheme } from '../theme-provider';
import { Button, Card, Text } from '../ui';

type Props = {
  workout: NextPlanWorkout;
  /** Shows the Deload badge: the plan is in its deload phase. */
  deload: boolean;
  onStart: () => void;
  /** Week of the load phase the plan is in (1 in the deload phase); locates the program week of a rest day. */
  cycleWeek: number;
  /** "Mark rest day as done" of a program rest day. */
  onCompleteRestDay: () => void;
};

/**
 * The program blocks of the workout as `Program · week W · day D` lines. The week comes from the
 * generated exercises; a rest day has none, so it is derived from the cycle week (deload: week 1).
 */
function programLines(workout: NextPlanWorkout, cycleWeek: number, format: StrengthFormat): string[] {
  return (workout.programs ?? []).flatMap((link) => {
    const program = findProgram(link.programId);
    if (!program) return [];
    const generated = workout.exercises.find((exercise) => exercise.generated?.linkId === link.id)?.generated;
    const programWeek = generated?.programWeek ?? programWeekFor(link.startWeek, cycleWeek, program.durationWeeks);
    return [format.origin({ kind: 'program', programId: link.programId, programWeek, day: link.day })];
  });
}

/**
 * The suggested next workout of the active plan, with the Start action. A workout with v4 content
 * (program blocks or percent exercises) also names the program week and day and lists the week's
 * exercises with their prescription; a rest day shows the program notes instead of Start.
 */
export function NextWorkoutCard({ workout, deload, onStart, cycleWeek, onCompleteRestDay }: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const format = useStrengthFormat();
  const nameOf = useExerciseName();
  const findExercise = useAppStore(selectFindExercise);

  const hasStrengthContent =
    workout.isRestDay ||
    workout.exercises.some((exercise) => exercise.generated !== undefined || workout.prescriptions[exercise.id]);
  const lines = programLines(workout, cycleWeek, format);

  const detail = (exercise: NextPlanWorkout['exercises'][number]): string => {
    const prescription = workout.prescriptions[exercise.id];
    if (prescription) return format.prescription(prescription.sets);
    return exercise.repMin === exercise.repMax
      ? t('home.next.automaticFixed', { sets: exercise.sets, reps: exercise.repMin })
      : t('home.next.automatic', { sets: exercise.sets, min: exercise.repMin, max: exercise.repMax });
  };

  return (
    <Card testID="next-workout-card">
      <Text variant="caption" tone="secondary">
        {t('home.next.title')}
      </Text>
      <View style={styles.row}>
        <Text variant="heading" style={styles.name}>
          {workout.name}
        </Text>
        {deload ? (
          <View style={[styles.badge, { borderColor: colors.accent }]}>
            <Text variant="caption" tone="accent">
              {t('home.next.deload')}
            </Text>
          </View>
        ) : null}
        {workout.isRestDay ? (
          <View style={[styles.badge, { borderColor: colors.accent }]}>
            <Text variant="caption" tone="accent">
              {t('home.next.restDay')}
            </Text>
          </View>
        ) : null}
      </View>

      {lines.length > 0 ? (
        <View testID="next-workout-program">
          {lines.map((line) => (
            <Text key={line} tone="secondary">
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      {workout.isRestDay
        ? workout.notes.map((note, index) => (
            <Text key={index} testID="next-workout-note">
              {format.text(note)}
            </Text>
          ))
        : null}

      {hasStrengthContent && workout.exercises.length > 0 ? (
        <View testID="next-workout-exercises" accessibilityLabel={t('home.next.exercises')} style={styles.exercises}>
          {workout.exercises.map((exercise) => {
            const found = findExercise(exercise.exerciseId);
            return (
              <View key={exercise.id} style={styles.exercise}>
                <Text style={styles.exerciseName}>{found ? nameOf(found) : exercise.exerciseId}</Text>
                <Text tone="secondary" tabular>
                  {detail(exercise)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {workout.isRestDay ? (
        <Button label={t('home.next.markRestDone')} onPress={onCompleteRestDay} />
      ) : (
        <Button label={t('home.next.start')} onPress={onStart} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  name: { flexShrink: 1 },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
  },
  exercises: { gap: spacing.xs },
  exercise: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' },
  exerciseName: { flexShrink: 1 },
});
