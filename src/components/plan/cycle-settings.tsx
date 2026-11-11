import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { suggestCycle, type CycleConfig } from '@/domain/cycle';
import { PLAN_LIMITS, type Plan } from '@/domain/plan';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/state';

import { Stepper } from '../shared';
import { Button, Text } from '../ui';

/** Cycle factors are edited as whole percentages (steps of 5) so no float error creeps in. */
type Form = { loadWeeks: number; deloadWeeks: number; volumePct: number; loadPct: number };

const toForm = (cycle: CycleConfig): Form => ({
  loadWeeks: cycle.loadWeeks,
  deloadWeeks: cycle.deloadWeeks,
  volumePct: Math.round(cycle.deloadVolumeFactor * 100),
  loadPct: Math.round(cycle.deloadLoadFactor * 100),
});

const toCycle = (form: Form): CycleConfig => ({
  loadWeeks: form.loadWeeks,
  deloadWeeks: form.deloadWeeks,
  deloadVolumeFactor: form.volumePct / 100,
  deloadLoadFactor: form.loadPct / 100,
});

const pct = (limit: { min: number; max: number }) => ({
  min: Math.round(limit.min * 100),
  max: Math.round(limit.max * 100),
});

/** The editable cycle configuration of a plan: steppers, Suggest and Save. */
export function CycleSettings({ plan }: { plan: Plan }) {
  const { t, formatPercent } = useI18n();
  const experience = useAppStore((s) => s.settings?.experience ?? 'intermediate');
  const setCycleConfig = useAppStore((s) => s.setCycleConfig);
  const [form, setForm] = useState<Form>(() => toForm(plan.cycle));
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saved = toForm(plan.cycle);
  const dirty = (Object.keys(form) as (keyof Form)[]).some((k) => form[k] !== saved[k]);
  const patch = (changes: Partial<Form>) => {
    setForm((f) => ({ ...f, ...changes }));
    setNote(null);
  };

  const suggest = () => {
    setForm(toForm(suggestCycle(experience)));
    setNote(t('plan.cycle.suggested', { level: t(`plan.cycle.levels.${experience}`) }));
  };

  const save = async () => {
    setError(null);
    try {
      await setCycleConfig(plan.id, toCycle(form));
      setNote(t('plan.cycle.saved'));
    } catch {
      setNote(null);
      setError(t('plan.errors.generic'));
    }
  };

  const volume = pct(PLAN_LIMITS.deloadVolumeFactor);
  const load = pct(PLAN_LIMITS.deloadLoadFactor);
  const percentFormat = (value: number) => formatPercent(value / 100);

  return (
    <View style={styles.container} testID="cycle-settings">
      <Row label={t('plan.cycle.loadWeeks')}>
        <Stepper
          label={t('plan.cycle.loadWeeks')}
          value={form.loadWeeks}
          min={PLAN_LIMITS.loadWeeks.min}
          max={PLAN_LIMITS.loadWeeks.max}
          onChange={(loadWeeks) => patch({ loadWeeks })}
        />
      </Row>
      <Row label={t('plan.cycle.deloadWeeks')}>
        <Stepper
          label={t('plan.cycle.deloadWeeks')}
          value={form.deloadWeeks}
          min={PLAN_LIMITS.deloadWeeks.min}
          max={PLAN_LIMITS.deloadWeeks.max}
          onChange={(deloadWeeks) => patch({ deloadWeeks })}
        />
      </Row>
      <Row label={t('plan.cycle.deloadVolume')}>
        <Stepper
          label={t('plan.cycle.deloadVolume')}
          value={form.volumePct}
          min={volume.min}
          max={volume.max}
          step={5}
          format={percentFormat}
          onChange={(volumePct) => patch({ volumePct })}
        />
      </Row>
      <Row label={t('plan.cycle.deloadLoad')}>
        <Stepper
          label={t('plan.cycle.deloadLoad')}
          value={form.loadPct}
          min={load.min}
          max={load.max}
          step={5}
          format={percentFormat}
          onChange={(loadPct) => patch({ loadPct })}
        />
      </Row>
      <Text tone="secondary">
        {form.deloadWeeks === 0
          ? t('plan.cycle.explanationNone')
          : t('plan.cycle.explanation', {
              volume: percentFormat(form.volumePct),
              load: percentFormat(form.loadPct),
            })}
      </Text>
      {note ? <Text accessibilityRole="alert">{note}</Text> : null}
      {error ? (
        <Text tone="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button variant="secondary" label={t('plan.cycle.suggest')} onPress={suggest} />
        <Button label={t('plan.cycle.save')} onPress={save} disabled={!dirty} />
      </View>
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  rowLabel: { flexShrink: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
