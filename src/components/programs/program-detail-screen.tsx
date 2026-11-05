import { useMemo } from 'react';

import { useI18n } from '@/i18n';
import { resolveParamValues, resolveTemplate } from '@/programs/params';
import { findTemplate } from '@/programs/registry';
import { selectProgramParamOverrides } from '@/state/app-store';
import { useAppStore } from '@/state/app-store-context';

import { Button, Card, Screen, Text } from '../ui';
import { PercentConfig } from './percent-config';
import { ProgramStructure } from './program-structure';
import { VerificationBadge } from './verification-badge';

const SOURCE_DATE: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
};

export type ProgramDetailScreenProps = { templateId: string; onBack?: () => void };

/**
 * Program detail (SPEC §3.5): identity, source and verification, the full original structure
 * week by week and, for templates with configurable percentages, the profile's own values.
 */
export function ProgramDetailScreen({ templateId, onBack }: ProgramDetailScreenProps) {
  const { t, formatDate } = useI18n();
  const template = findTemplate(templateId);
  const overrides = useAppStore(selectProgramParamOverrides(templateId));
  const values = useMemo(() => (template ? resolveParamValues(template, overrides) : {}), [template, overrides]);
  const resolved = useMemo(() => (template ? resolveTemplate(template, values) : null), [template, values]);

  const back = onBack ? <Button variant="secondary" label={t('programs.back')} onPress={onBack} /> : null;
  if (!template || !resolved) {
    return (
      <Screen title={t('programs.title')} testID="screen-program-detail">
        {back}
        <Text tone="secondary">{t('programs.notFound')}</Text>
      </Screen>
    );
  }

  const { source } = template;
  return (
    <Screen title={template.name} testID="screen-program-detail">
      {back}
      <Card>
        <VerificationBadge status={template.verification} />
        <Text tone="secondary">{t('programs.version', { version: template.version })}</Text>
        <Text tone="secondary">{t('programs.duration', { count: template.durationWeeks })}</Text>
        <Text tone="secondary">{t('programs.frequency', { count: template.daysPerWeek })}</Text>
        <Text tone="secondary">
          {t('programs.detail.lifts', {
            lifts: template.allowedLifts.map((lift) => t(`lifts.${lift}`)).join(', '),
          })}
        </Text>
        {template.liftSelectable ? <Text tone="secondary">{t('programs.detail.liftChoice')}</Text> : null}
      </Card>
      <Card>
        <Text variant="heading">{t('programs.detail.source')}</Text>
        <Text tone="secondary">{t('programs.detail.author', { author: source.author })}</Text>
        <Text tone="secondary">{t('programs.detail.reference', { reference: source.reference })}</Text>
        {source.url ? <Text tone="secondary">{t('programs.detail.url', { url: source.url })}</Text> : null}
        <Text tone="secondary">
          {t('programs.detail.accessed', {
            date: formatDate(new Date(`${source.accessedAt}T00:00:00Z`), SOURCE_DATE),
          })}
        </Text>
        {source.notes ? <Text tone="secondary">{t('programs.detail.notes', { notes: source.notes })}</Text> : null}
      </Card>
      <PercentConfig template={template} values={values} />
      <Text variant="heading">{t('programs.detail.structure')}</Text>
      <ProgramStructure template={resolved} />
    </Screen>
  );
}
