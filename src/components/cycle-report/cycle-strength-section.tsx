import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { selectCycleStrengthReport, selectFindExercise, useAppStore } from '@/state';

import { useStrengthFormat } from '../progress/strength-format';
import { ConfirmDialog, useExerciseName } from '../shared';
import { Button, Card, Text } from '../ui';

type Pending = { kind: 'update'; exerciseId: string; kg: number } | { kind: 'continue' } | null;

/**
 * "Programs and 1RMs" of the cycle report (SPEC-v4 §10.7): per basis exercise the reference at the
 * start and now, the best strength estimate and a suggested 1RM; per program block the weeks
 * trained; and the action to continue with the next block. Renders nothing without either.
 */
export function CycleStrengthSection({ planId, cycleNumber }: { planId: number; cycleNumber: number }) {
  const { t } = useI18n();
  const format = useStrengthFormat();
  const nameOf = useExerciseName();
  const findExercise = useAppStore(selectFindExercise);
  const report = useAppStore((state) => selectCycleStrengthReport(state, planId, cycleNumber));
  const applyEstimate = useAppStore((state) => state.useEstimateAsMax);
  const advanceProgramBlocks = useAppStore((state) => state.advanceProgramBlocks);
  const [pending, setPending] = useState<Pending>(null);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);

  if (!report || (report.exercises.length === 0 && report.blocks.length === 0)) return null;

  const name = (exerciseId: string) => {
    const found = findExercise(exerciseId);
    return found ? nameOf(found) : exerciseId;
  };
  const kg = (value: number | null) => (value === null ? t('cycleReport.noLoad') : format.kg(value, 2));

  const confirm = async () => {
    const action = pending;
    setPending(null);
    if (!action) return;
    try {
      if (action.kind === 'update') {
        await applyEstimate(action.exerciseId, action.kg);
        setMessage({
          text: t('cycleReport.strength.updated', { name: name(action.exerciseId), kg: format.kg(action.kg, 2) }),
          failed: false,
        });
      } else {
        await advanceProgramBlocks(planId);
        setMessage({ text: t('cycleReport.strength.continued'), failed: false });
      }
    } catch {
      setMessage({ text: t('cycleReport.strength.failed'), failed: true });
    }
  };

  const updating = pending?.kind === 'update' ? pending : null;

  return (
    <View style={styles.section} testID="cycle-report-strength">
      <Text variant="heading">{t('cycleReport.strength.title')}</Text>

      {report.exercises.map((row) => (
        <Card key={row.exerciseId} testID={`report-strength-${row.exerciseId}`}>
          <Text variant="label">{name(row.exerciseId)}</Text>
          <Text tabular>
            {t('cycleReport.strength.reference', { from: kg(row.referenceAtStartKg), to: kg(row.referenceNowKg) })}
          </Text>
          {row.bestEstimateKg !== null ? (
            <Text tabular>{t('cycleReport.strength.bestEstimate', { kg: format.kg(row.bestEstimateKg) })}</Text>
          ) : null}
          {row.suggestedKg !== null ? (
            <Button
              variant="secondary"
              label={t('cycleReport.strength.update', { kg: format.kg(row.suggestedKg, 2) })}
              onPress={() => setPending({ kind: 'update', exerciseId: row.exerciseId, kg: row.suggestedKg as number })}
            />
          ) : null}
        </Card>
      ))}

      {report.blocks.map((block) => (
        <Card key={block.linkId} testID={`report-block-${block.linkId}`}>
          <Text variant="label">
            {t('cycleReport.strength.block', {
              program: format.programName(block.programId),
              workout: block.workoutName,
            })}
          </Text>
          <Text tone="secondary" tabular>
            {block.fromWeek === block.toWeek
              ? t('cycleReport.strength.blockWeek', { week: block.fromWeek, total: block.durationWeeks })
              : t('cycleReport.strength.blockWeeks', {
                  from: block.fromWeek,
                  to: block.toWeek,
                  total: block.durationWeeks,
                })}
          </Text>
        </Card>
      ))}

      {message ? (
        <Text tone={message.failed ? 'danger' : 'accent'} accessibilityLiveRegion="polite">
          {message.text}
        </Text>
      ) : null}

      {report.hasNextBlock ? (
        <Button label={t('cycleReport.strength.continue')} onPress={() => setPending({ kind: 'continue' })} />
      ) : null}

      <ConfirmDialog
        visible={pending !== null}
        title={t(updating ? 'cycleReport.strength.updateTitle' : 'cycleReport.strength.continueTitle')}
        message={
          updating
            ? t('cycleReport.strength.updateMessage', { name: name(updating.exerciseId), kg: format.kg(updating.kg, 2) })
            : t('cycleReport.strength.continueMessage')
        }
        confirmLabel={t(updating ? 'cycleReport.strength.updateConfirm' : 'cycleReport.strength.continueConfirm')}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
});
