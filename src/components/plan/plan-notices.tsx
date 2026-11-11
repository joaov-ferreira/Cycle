import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import type { Plan } from '@/domain/plan';
import type { FidelityWarning } from '@/domain/program-plan';
import { useI18n } from '@/i18n';
import {
  selectFidelityWarnings,
  selectFindExercise,
  selectMissingMaxes,
  useAppStore,
} from '@/state';
import { findProgram } from '@/library';

import { exerciseName } from '../shared';
import { Button, Card, Text } from '../ui';
import { localText } from './prescription-text';

export type PlanNoticesProps = {
  plan: Plan;
  /** Opens the 1RM screen of an exercise; without it the missing-1RM notice only lists them. */
  onOpenMax?: (exerciseId: string) => void;
};

/** Non-blocking notices of a plan: program fidelity warnings and the exercises that lack a 1RM. */
export function PlanNotices({ plan, onOpenMax }: PlanNoticesProps) {
  const warnings = useAppStore((s) => selectFidelityWarnings(s, plan.id));
  const missing = useAppStore((s) => selectMissingMaxes(s, plan.id));
  return (
    <>
      {warnings.length > 0 ? <FidelityNotice warnings={warnings} /> : null}
      {missing.length > 0 ? <MissingMaxesNotice exerciseIds={missing} onOpenMax={onOpenMax} /> : null}
    </>
  );
}

function FidelityNotice({ warnings }: { warnings: readonly FidelityWarning[] }) {
  const { t, locale } = useI18n();
  return (
    <Card testID="plan-fidelity" style={styles.notice}>
      <Text variant="label" accessibilityRole="header">
        {t('plan.fidelity.heading')}
      </Text>
      {warnings.map((warning) => {
        const program = findProgram(warning.programId);
        const programName = program?.name ?? warning.programId;
        const key = `${warning.code}:${warning.programId}:${warning.exerciseId}`;
        if (warning.code === 'incompleteFrequency') {
          return (
            <Text key={key} tone="secondary">
              {t('plan.fidelity.incompleteFrequency', {
                program: programName,
                count: warning.daysPerWeek,
                used: warning.daysUsed,
              })}
            </Text>
          );
        }
        const role = program?.roles.find((candidate) => candidate.id === warning.role);
        return (
          <Text key={`${key}:${warning.role}`} tone="secondary">
            {t('plan.fidelity.notOriginalExercise', {
              program: programName,
              role: role ? localText(role.label, locale) : warning.role,
            })}
          </Text>
        );
      })}
    </Card>
  );
}

function MissingMaxesNotice({
  exerciseIds,
  onOpenMax,
}: {
  exerciseIds: readonly string[];
  onOpenMax?: (exerciseId: string) => void;
}) {
  const { t, locale } = useI18n();
  const find = useAppStore(selectFindExercise);
  return (
    <Card testID="plan-missing-maxes" style={styles.notice}>
      <Text variant="label" accessibilityRole="header">
        {t('plan.missingMaxes.title')}
      </Text>
      <Text tone="secondary">{t('plan.missingMaxes.message')}</Text>
      <View style={styles.buttons}>
        {exerciseIds.map((exerciseId) => {
          const found = find(exerciseId);
          const name = found ? exerciseName(found, locale) : exerciseId;
          return onOpenMax ? (
            <Button
              key={exerciseId}
              variant="secondary"
              label={name}
              accessibilityLabel={t('plan.missingMaxes.setFor', { exercise: name })}
              onPress={() => onOpenMax(exerciseId)}
            />
          ) : (
            <Text key={exerciseId} variant="label">
              {name}
            </Text>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  notice: { gap: spacing.sm },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
