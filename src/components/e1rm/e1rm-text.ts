import type { E1rmFormula, SetEstimate } from '@/domain/e1rm/estimate';
import type { E1rmComparison } from '@/domain/e1rm/session';
import { useI18n, type MessageKey } from '@/i18n';

const FORMULA_KEYS: Record<E1rmFormula, MessageKey> = {
  rts: 'e1rm.formulas.rts',
  'epley-rir': 'e1rm.formulas.epleyRir',
  'brzycki-rir': 'e1rm.formulas.brzyckiRir',
};

/** Localized texts of the e1RM engine (estimates, validity, comparison, formula names). */
export function useE1rmText() {
  const { t, formatKg, formatPercent } = useI18n();
  const signed = (text: string, value: number) => `${value > 0 ? '+' : ''}${text}`;
  return {
    formula: (formula: E1rmFormula) => t(FORMULA_KEYS[formula]),
    /** One set's estimate, or null when there is nothing to show (no effort, failure, no weight). */
    setEstimate(estimate: SetEstimate): string | null {
      switch (estimate.status) {
        case 'valid':
          return t('e1rm.estimate', { value: formatKg(estimate.e1rmKg, { maximumFractionDigits: 1 }) });
        case 'lowConfidence': {
          const reason = t(`e1rm.reasons.${estimate.reason}`);
          return estimate.e1rmKg === null
            ? t('e1rm.lowConfidenceNoValue', { reason })
            : t('e1rm.lowConfidence', { value: formatKg(estimate.e1rmKg, { maximumFractionDigits: 1 }), reason });
        }
        case 'unverified':
          return t('e1rm.unverified');
        case 'none':
          return null;
      }
    },
    value: (kg: number) => formatKg(kg, { maximumFractionDigits: 1 }),
    comparison: (comparison: E1rmComparison | null) =>
      comparison === null
        ? t('e1rm.noPrevious')
        : t('e1rm.previous', {
            value: formatKg(comparison.previousKg, { maximumFractionDigits: 1 }),
            deltaKg: signed(formatKg(comparison.deltaKg, { maximumFractionDigits: 1 }), comparison.deltaKg),
            deltaPercent: signed(formatPercent(comparison.deltaPercent / 100), comparison.deltaPercent),
          }),
  };
}
