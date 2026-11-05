import { E1RM_FORMULAS, type E1rmFormula } from '@/domain/e1rm/estimate';
import { useT } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';
import { selectE1rmFormula } from '@/state/e1rm-selectors';

import { useE1rmText } from '../e1rm/e1rm-text';
import { Card, SegmentedControl, Text } from '../ui';

/** e1RM formula for new estimates (SPEC §8.1); stored estimates keep their own formula. */
export function E1rmSection() {
  const t = useT();
  const text = useE1rmText();
  const formula = useAppStore(selectE1rmFormula);
  const setFormula = useAppStore((s) => s.setE1rmFormula);
  const options = E1RM_FORMULAS.map((value): { value: E1rmFormula; label: string } => ({
    value,
    label: text.formula(value),
  }));
  return (
    <Card>
      <Text variant="heading">{t('settings.e1rm.title')}</Text>
      <SegmentedControl
        label={t('settings.e1rm.label')}
        options={options}
        value={formula}
        onChange={(value) => void setFormula(value)}
      />
      <Text variant="caption" tone="secondary">
        {t('settings.e1rm.description')}
      </Text>
    </Card>
  );
}
