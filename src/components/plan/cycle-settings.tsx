import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { suggestCycle, weekTargetRir, type CycleConfig } from '@/domain/cycle';
import { PLAN_LIMITS, type Plan } from '@/domain/plan';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/state';

import { Stepper } from '../shared';
import { useTheme } from '../theme-provider';
import { Button, Text } from '../ui';

/** Cycle factors are edited as whole percentages (steps of 5) so no float error creeps in. */
type Form = {
  loadWeeks: number;
  deloadWeeks: number;
  volumePct: number;
  loadPct: number;
  rampOn: boolean;
  rampStart: number;
  rampEnd: number;
};

/** The ramp shown when it is switched on for the first time (SPEC-v3 §5 example). */
const DEFAULT_RAMP = { start: 3, end: 0 };

const toForm = (cycle: CycleConfig): Form => ({
  loadWeeks: cycle.loadWeeks,
  deloadWeeks: cycle.deloadWeeks,
  volumePct: Math.round(cycle.deloadVolumeFactor * 100),
  loadPct: Math.round(cycle.deloadLoadFactor * 100),
  rampOn: !!cycle.rirRamp,
  rampStart: (cycle.rirRamp ?? DEFAULT_RAMP).start,
  rampEnd: (cycle.rirRamp ?? DEFAULT_RAMP).end,
});

/** `rirRamp` is `null` when switched off; a cycle that never had a ramp keeps no such property. */
const toCycle = (form: Form, hadRamp = true): CycleConfig => {
  const cycle: CycleConfig = {
    loadWeeks: form.loadWeeks,
    deloadWeeks: form.deloadWeeks,
    deloadVolumeFactor: form.volumePct / 100,
    deloadLoadFactor: form.loadPct / 100,
  };
  if (form.rampOn) cycle.rirRamp = { start: form.rampStart, end: form.rampEnd };
  else if (hadRamp) cycle.rirRamp = null;
  return cycle;
};

const pct = (limit: { min: number; max: number }) => ({
  min: Math.round(limit.min * 100),
  max: Math.round(limit.max * 100),
});

/** The editable cycle configuration of a plan: steppers, Suggest and Save. */
export function CycleSettings({ plan }: { plan: Plan }) {
  const { t, formatPercent, formatNumber } = useI18n();
  const experience = useAppStore((s) => s.settings?.experience ?? 'intermediate');
  const setCycleConfig = useAppStore((s) => s.setCycleConfig);
  const [form, setForm] = useState<Form>(() => toForm(plan.cycle));
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { colors } = useTheme();
  const saved = toForm(plan.cycle);
  const dirty = JSON.stringify(toCycle(form, false)) !== JSON.stringify(toCycle(saved, false));
  const patch = (changes: Partial<Form>) => {
    setForm((f) => ({ ...f, ...changes }));
    setNote(null);
  };

  const suggest = () => {
    setForm((f) => ({
      ...toForm(suggestCycle(experience)),
      rampOn: f.rampOn,
      rampStart: f.rampStart,
      rampEnd: f.rampEnd,
    }));
    setNote(t('plan.cycle.suggested', { level: t(`plan.cycle.levels.${experience}`) }));
  };

  const save = async () => {
    setError(null);
    try {
      await setCycleConfig(plan.id, toCycle(form, !!plan.cycle.rirRamp));
      setNote(t('plan.cycle.saved'));
    } catch {
      setNote(null);
      setError(t('plan.errors.generic'));
    }
  };

  const volume = pct(PLAN_LIMITS.deloadVolumeFactor);
  const load = pct(PLAN_LIMITS.deloadLoadFactor);
  const percentFormat = (value: number) => formatPercent(value / 100);
  const rampTargets = form.rampOn
    ? Array.from({ length: form.loadWeeks }, (_, i) =>
        weekTargetRir(toCycle(form), { ...plan.cycleState, phase: 'load', week: i + 1 }),
      )
    : [];

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
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{t('plan.cycle.rampToggle')}</Text>
        <Switch
          accessibilityRole="switch"
          accessibilityLabel={t('plan.cycle.rampToggle')}
          accessibilityState={{ checked: form.rampOn }}
          value={form.rampOn}
          onValueChange={(rampOn) => patch({ rampOn })}
          trackColor={{ true: colors.accent }}
        />
      </View>
      {form.rampOn ? (
        <>
          <Row label={t('plan.cycle.rampStart')}>
            <Stepper
              label={t('plan.cycle.rampStart')}
              value={form.rampStart}
              min={PLAN_LIMITS.rirRamp.min}
              max={PLAN_LIMITS.rirRamp.max}
              onChange={(rampStart) => patch({ rampStart, rampEnd: Math.min(form.rampEnd, rampStart) })}
            />
          </Row>
          <Row label={t('plan.cycle.rampEnd')}>
            <Stepper
              label={t('plan.cycle.rampEnd')}
              value={form.rampEnd}
              min={PLAN_LIMITS.rirRamp.min}
              max={PLAN_LIMITS.rirRamp.max}
              onChange={(rampEnd) => patch({ rampEnd, rampStart: Math.max(form.rampStart, rampEnd) })}
            />
          </Row>
          <Text testID="ramp-preview" tabular>
            {t('plan.cycle.rampPreview', { values: rampTargets.map((v) => formatNumber(v ?? 0)).join(', ') })}
          </Text>
          <Text tone="secondary">{t('plan.cycle.rampExplanation')}</Text>
        </>
      ) : null}
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
