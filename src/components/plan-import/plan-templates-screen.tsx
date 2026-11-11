import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { suggestCycle } from '@/domain/cycle';
import type { Plan } from '@/domain/plan';
import { useI18n, type TFunction } from '@/i18n';
import { findProgram } from '@/library/programs';
import { instantiateTemplate, listAllPlanTemplates, type PlanTemplate } from '@/library/plan-templates';
import { selectFindExercise } from '@/state/selectors';
import { useAppStore } from '@/state/app-store-context';

import { Button, Card, Screen, Text } from '../ui';
import { exerciseName } from '../shared';
import { useTargetLabel } from './messages';
import { OptionCard } from './option-card';

export type PlanTemplatesScreenProps = {
  /** Called with the created plan (the route replaces the gallery with the plan's detail). */
  onCreated: (plan: Plan) => void;
  onBack?: () => void;
};

function summary(t: TFunction, template: PlanTemplate): string {
  return t('planImport.templates.summary', {
    workouts: t('planImport.templates.workouts', { count: template.workouts.length }),
    sessions: t('planImport.templates.sessions', { count: template.sessionsPerWeek }),
  });
}

/** Template gallery (SPEC §3.3): browse the built-in templates and create a plan from one. */
export function PlanTemplatesScreen({ onCreated, onBack }: PlanTemplatesScreenProps) {
  const { t, locale } = useI18n();
  const createPlan = useAppStore((s) => s.createPlan);
  const experience = useAppStore((s) => s.settings?.experience) ?? 'intermediate';
  const findExercise = useAppStore(selectFindExercise);
  const targetLabel = useTargetLabel();
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const exerciseLabel = (exerciseId: string): string => {
    const exercise = findExercise(exerciseId);
    return exercise ? exerciseName(exercise, locale) : exerciseId;
  };

  const templates = listAllPlanTemplates();
  const open = templates.find((template) => template.id === openId) ?? null;

  const use = async (template: PlanTemplate) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const plan = await createPlan(instantiateTemplate(template, locale, suggestCycle(experience)));
      onCreated(plan);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  if (open) {
    return (
      <Screen title={open.name[locale]} testID="screen-plan-templates">
        <Button variant="secondary" label={t('planImport.templates.backToList')} onPress={() => setOpenId(null)} />
        <Text tone="secondary">{open.description[locale]}</Text>
        <Text variant="label">{summary(t, open)}</Text>
        {open.workouts.map((workout, workoutIndex) => (
          <Card key={workoutIndex}>
            <Text variant="heading">{workout.name[locale]}</Text>
            {(workout.programs ?? []).map((block, index) => (
              <Text key={`block-${index}`} variant="label" tone="accent">
                {t('planImport.templates.block', {
                  program: findProgram(block.programId)?.name ?? block.programId,
                  exercise: [...new Set(Object.values(block.roles))].map(exerciseLabel).join(', '),
                })}
              </Text>
            ))}
            {workout.exercises.map((item, index) => {
              return (
                <View key={index} style={styles.row}>
                  <Text style={styles.rowName}>{exerciseLabel(item.exerciseId)}</Text>
                  <Text tone="secondary" tabular>
                    {targetLabel(item.sets, item.repMin, item.repMax)}
                  </Text>
                </View>
              );
            })}
          </Card>
        ))}
        {failed ? (
          <Text tone="danger" accessibilityLiveRegion="polite">
            {t('planImport.templates.useError')}
          </Text>
        ) : null}
        <Button label={t('planImport.templates.use')} onPress={() => use(open)} disabled={busy} />
      </Screen>
    );
  }

  return (
    <Screen title={t('planImport.templates.title')} testID="screen-plan-templates">
      {onBack ? <Button variant="secondary" label={t('planImport.back')} onPress={onBack} /> : null}
      <Text tone="secondary">{t('planImport.templates.intro')}</Text>
      {templates.map((template) => (
        <OptionCard
          key={template.id}
          title={template.name[locale]}
          accessibilityLabel={t('planImport.templates.open', { name: template.name[locale] })}
          body={template.description[locale]}
          meta={summary(t, template)}
          onPress={() => setOpenId(template.id)}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowName: { flex: 1 },
});
