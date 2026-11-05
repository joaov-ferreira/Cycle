import { useState } from 'react';

import type { NumberRules } from '@/domain/number-validation';
import { useI18n } from '@/i18n';
import { pickLocalized } from '@/programs/localized';
import type { ConfigurableParam, ProgramTemplate } from '@/programs/schema';
import type { ParamValues } from '@/programs/params';
import { useAppStore } from '@/state/app-store-context';

import { Button, Card, NumberInput, Text } from '../ui';

/** Fractions are edited as percentages; these keep 0.755 <-> 75.5 free of floating-point noise. */
const toPercent = (fraction: number) => Math.round(fraction * 1e4) / 100;
const toFraction = (percent: number) => Math.round(percent * 100) / 1e4;

function rulesFor(param: ConfigurableParam): NumberRules {
  return {
    required: true,
    min: toPercent(param.min),
    max: toPercent(param.max),
    step: param.step === undefined ? undefined : toPercent(param.step),
    maxDecimals: 1,
  };
}

/**
 * Edit the percentage parameters of a template (SPEC §3.3-A: per-week 5/3/1 percentages,
 * 30–105 % in 0.5 % steps). Only valid values are saved; the rules come from the template.
 */
export function PercentConfig({ template, values }: { template: ProgramTemplate; values: ParamValues }) {
  const { t, locale, formatPercent } = useI18n();
  const setProgramParam = useAppStore((s) => s.setProgramParam);
  const resetProgramParams = useAppStore((s) => s.resetProgramParams);
  const [resets, setResets] = useState(0);
  const params = (template.configurable ?? []).filter((param) => param.unit === 'fraction');
  if (params.length === 0) return null;

  const first = params[0];
  return (
    <Card>
      <Text variant="heading">{t('programs.config.title')}</Text>
      <Text tone="secondary">
        {t('programs.config.description', {
          min: formatPercent(first.min),
          max: formatPercent(first.max),
          step: formatPercent(first.step ?? 0),
        })}
      </Text>
      {params.map((param) => (
        <NumberInput
          key={`${param.id}:${resets}`}
          label={pickLocalized(param.label, locale)}
          unit={t('programs.config.unit')}
          value={toPercent(values[param.id])}
          rules={rulesFor(param)}
          onChange={(change) => {
            if (change.value !== null) void setProgramParam(template.id, param.id, toFraction(change.value));
          }}
        />
      ))}
      <Button
        variant="secondary"
        label={t('programs.config.reset')}
        onPress={() => {
          setResets((n) => n + 1);
          void resetProgramParams(template.id);
        }}
      />
    </Card>
  );
}
