import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { weekTargetRir } from '@/domain/cycle';
import { supersetLayout, type Plan } from '@/domain/plan';
import type { Prescription } from '@/domain/prescription';
import type { Suggestion } from '@/domain/progression';
import type { EffectiveExercise } from '@/domain/program-plan';
import { useI18n } from '@/i18n';
import { findProgram } from '@/library';
import {
  selectActivePlan,
  selectEffectiveWorkout,
  selectEffortScale,
  selectFindExercise,
  useAppStore,
} from '@/state';

import { exerciseName } from '../shared';
import { Button, Card, Text } from '../ui';
import { useTheme } from '../theme-provider';
import { PlanBadge } from './plan-badge';
import { PlanNotices } from './plan-notices';
import { effortText, localText, prescriptionLines, targetText } from './prescription-text';

export type PlanWorkoutsProps = {
  plan: Plan;
  /** Opens the periodization table of the plan. */
  onOpenPeriodization?: (planId: number) => void;
  /** Opens the 1RM screen of an exercise. */
  onOpenMax?: (exerciseId: string) => void;
};

/**
 * The workouts of a plan as they are trained this week (program blocks and percent schemes
 * expanded, with loads), the plan's notices and the link to the periodization table.
 */
export function PlanWorkouts({ plan, onOpenPeriodization, onOpenMax }: PlanWorkoutsProps) {
  const { t } = useI18n();
  const nextId = useAppStore((s) => {
    const active = selectActivePlan(s);
    if (!active || active.id !== plan.id) return null;
    return (active.workouts[active.cycleState.nextWorkoutIndex] ?? active.workouts[0])?.id ?? null;
  });
  const weekRir = weekTargetRir(plan.cycle, plan.cycleState);
  return (
    <View style={styles.container}>
      <PlanNotices plan={plan} onOpenMax={onOpenMax} />
      <Text variant="heading">{t('plan.workoutsHeading')}</Text>
      {onOpenPeriodization ? (
        <View style={styles.row}>
          <Button
            variant="secondary"
            label={t('plan.periodizationLink')}
            onPress={() => onOpenPeriodization(plan.id)}
          />
        </View>
      ) : null}
      {plan.workouts.map((workout, index) => (
        <WorkoutBlock
          key={workout.id}
          planId={plan.id}
          workoutId={workout.id}
          name={workout.name}
          index={index}
          isNext={workout.id === nextId}
          weekRir={weekRir}
        />
      ))}
    </View>
  );
}

function supersetTitle(t: ReturnType<typeof useI18n>['t'], size: number): string {
  if (size >= 4) return t('plan.superset.four');
  return size === 3 ? t('plan.superset.three') : t('plan.superset.two');
}

type WorkoutBlockProps = {
  planId: number;
  workoutId: string;
  name: string;
  index: number;
  isNext: boolean;
  weekRir: number | undefined;
};

function WorkoutBlock({ planId, workoutId, name, index, isNext, weekRir }: WorkoutBlockProps) {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const view = useAppStore((s) => selectEffectiveWorkout(s, planId, index));
  const effective = view?.workout;
  const exercises = effective?.exercises ?? [];
  return (
    <Card testID={`plan-workout-${workoutId}`}>
      <View style={styles.titleRow}>
        <Text variant="heading">{name}</Text>
        {isNext ? <PlanBadge label={t('plan.next')} /> : null}
      </View>
      {effective?.isRestDay ? <Text tone="secondary">{t('plan.rx.restDay')}</Text> : null}
      {effective?.notes.map((note) => (
        <Text key={note.en} tone="secondary" variant="caption">
          {localText(note, locale)}
        </Text>
      ))}
      {supersetLayout(exercises).map((block) => {
        const lines = block.indices.map((i) => {
          const exercise = exercises[i];
          return (
            <ExerciseLine
              key={exercise.id}
              exercise={exercise}
              prescription={view?.prescriptions[exercise.id] ?? null}
              suggestion={view?.suggestions[exercise.id]}
              weekRir={weekRir}
            />
          );
        });
        if (block.label === null) return lines;
        const title = supersetTitle(t, block.indices.length);
        return (
          <View
            key={`group-${exercises[block.indices[0]].id}`}
            testID="plan-superset"
            style={[styles.group, { borderColor: colors.accentText }]}>
            <Text variant="label" tone="accent" accessibilityRole="header">
              {title}
            </Text>
            {lines}
          </View>
        );
      })}
    </Card>
  );
}

type ExerciseLineProps = {
  exercise: EffectiveExercise;
  prescription: Prescription | null;
  suggestion?: Suggestion;
  weekRir: number | undefined;
};

function ExerciseLine({ exercise, prescription, suggestion, weekRir }: ExerciseLineProps) {
  const i18n = useI18n();
  const { t, locale, formatKg } = i18n;
  const find = useAppStore(selectFindExercise);
  const effortScale = useAppStore(selectEffortScale);
  const { generated } = exercise;
  const found = find(exercise.exerciseId);
  const name = generated?.label
    ? localText(generated.label, locale)
    : found
      ? exerciseName(found, locale)
      : exercise.exerciseId;
  const program = generated ? findProgram(generated.programId) : undefined;
  const note = generated?.note ? localText(generated.note, locale) : exercise.note;
  const basis = prescription && prescription.basisExerciseId !== exercise.exerciseId ? find(prescription.basisExerciseId) : undefined;
  const rir = weekRir ?? exercise.targetRir;
  const isFree = generated?.kind === 'free';

  return (
    <View style={styles.exercise}>
      <Text variant="label">{name}</Text>
      {generated ? (
        <Text tone="secondary" variant="caption">
          {t('plan.rx.programWeekDay', {
            program: program?.name ?? generated.programId,
            week: generated.programWeek,
            day: generated.day,
          })}
        </Text>
      ) : null}
      {prescription ? (
        <View style={styles.lines}>
          {prescriptionLines(i18n, prescription).map((line, i) => (
            <Text key={`${i}:${line}`} tone="secondary" tabular>
              {line}
            </Text>
          ))}
          {basis ? (
            <Text tone="secondary" variant="caption">
              {t('plan.rx.basis', { exercise: exerciseName(basis, locale) })}
            </Text>
          ) : null}
        </View>
      ) : isFree ? null : (
        <View style={styles.detailRow}>
          <Text tone="secondary" tabular>
            {targetText(i18n, exercise.sets, exercise.repMin, exercise.repMax)}
          </Text>
          {rir !== undefined ? (
            <Text tone="secondary">
              {weekRir !== undefined
                ? t('plan.targetRirThisWeek', { effort: effortText(i18n, rir, effortScale) })
                : effortText(i18n, rir, effortScale)}
            </Text>
          ) : null}
          {exercise.restSeconds !== undefined ? (
            <Text tone="secondary" tabular>
              {t('plan.rest', { seconds: exercise.restSeconds })}
            </Text>
          ) : null}
        </View>
      )}
      {generated?.unverified && !prescription ? (
        <Text tone="secondary" variant="caption">
          {t('plan.rx.unverified')}
        </Text>
      ) : null}
      {generated?.setNotes?.map((setNote) => (
        <Text key={setNote.en} tone="secondary" variant="caption">
          {localText(setNote, locale)}
        </Text>
      ))}
      {note ? (
        <Text tone="secondary" variant="caption">
          {t('plan.noteLabel', { note })}
        </Text>
      ) : null}
      {suggestion ? (
        <View style={styles.detailRow}>
          <Text tone="accent" tabular>
            {suggestion.loadKg === null
              ? t('plan.suggestionChoose')
              : t('plan.suggestionLoad', { load: formatKg(suggestion.loadKg, { minimumFractionDigits: 0 }) })}
          </Text>
          {suggestion.action === 'deload' ? <PlanBadge label={t('plan.deloadMarker')} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  group: { borderLeftWidth: 3, paddingLeft: spacing.sm, gap: spacing.xs },
  exercise: { gap: spacing.xs, paddingVertical: spacing.xs },
  lines: { gap: spacing.xs / 2 },
  detailRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.md },
});
