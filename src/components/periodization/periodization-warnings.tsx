import type { PeriodizationWarning } from '@/domain/periodization';
import { useT } from '@/i18n';
import { findTemplate } from '@/programs/registry';

import { Card, Text } from '../ui';

/** Localized messages for the periodization warning codes (SPEC §4.2). */
export function PeriodizationWarnings({ warnings }: { warnings: readonly PeriodizationWarning[] }) {
  const t = useT();
  if (warnings.length === 0) return null;
  const message = (warning: PeriodizationWarning): string => {
    switch (warning.code) {
      case 'missingOneRm':
        return t('periodization.warnings.missingOneRm', { lift: t(`lifts.${warning.lift}`) });
      case 'incompleteFrequency':
        return t('periodization.warnings.incompleteFrequency', {
          program: findTemplate(warning.templateId)?.name ?? warning.templateId,
          lift: t(`lifts.${warning.lift}`),
          count: warning.prescribed,
          configured: warning.configured,
        });
      case 'invalidSlot':
        return t('periodization.warnings.invalidSlot', {
          number: warning.sessionNumber,
          reason: t(`periodization.warnings.reason.${warning.reason}`),
        });
      case 'partialBlock':
        return t('periodization.warnings.partialBlock', { number: warning.sessionNumber, count: warning.weeks });
    }
  };
  return (
    <Card testID="periodization-warnings">
      <Text variant="heading">{t('periodization.warnings.title')}</Text>
      {warnings.map((warning, index) => (
        <Text key={index} tone="danger">
          {message(warning)}
        </Text>
      ))}
    </Card>
  );
}
