import { useState } from 'react';

import type { NumberRules } from '@/domain/number-validation';
import { useI18n } from '@/i18n';
import { pickLocalized } from '@/programs/localized';
import type { ParamValues } from '@/programs/params';
import type { ConfigurableParam, ProgramTemplate } from '@/programs/schema';
import { useAppStore } from '@/state/app-store-context';

import { Button, Card, NumberInput, Text } from '../ui';

const rulesFor = (param: ConfigurableParam): NumberRules => ({
  required: true,
  min: param.min,
  max: param.max,
  step: param.step,
  maxDecimals: 2,
});

/**
 * Edit the absolute (kg) increments a template leaves to the athlete (SPEC §3.3-C: the Smolov
 * Jr. weekly increment). Only values inside the original's range and step are saved.
 */
export function IncrementConfig({ template, values }: { template: ProgramTemplate; values: ParamValues }) {
  const { t, locale, formatKg } = useI18n();
  const setProgramParam = useAppStore((s) => s.setProgramParam);
  const resetProgramParams = useAppStore((s) => s.resetProgramParams);
  const [resets, setResets] = useState(0);
  const params = (template.configurable ?? []).filter((param) => param.unit === 'kg');
  if (params.length === 0) return null;

  return (
    <Card>
      <Text variant="heading">{t('programs.increments.title')}</Text>
      {params.map((param) => (
        <NumberInput
          key={`${param.id}:${resets}`}
          label={pickLocalized(param.label, locale)}
          unit={t('programs.increments.unit')}
          value={values[param.id]}
          rules={rulesFor(param)}
          onChange={(change) => {
            if (change.value !== null) void setProgramParam(template.id, param.id, change.value);
          }}
        />
      ))}
      {params.map((param) => (
        <Text key={param.id} variant="caption" tone="secondary">
          {t('programs.increments.range', {
            min: formatKg(param.min),
            max: formatKg(param.max),
            step: formatKg(param.step ?? 0),
          })}
        </Text>
      ))}
      <Button
        variant="secondary"
        label={t('programs.increments.reset')}
        onPress={() => {
          setResets((n) => n + 1);
          void resetProgramParams(template.id);
        }}
      />
    </Card>
  );
}
