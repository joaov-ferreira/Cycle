import { platesPerSide } from '@/domain/plates';
import type { I18nValue } from '@/i18n';

type Formatters = Pick<I18nValue, 't' | 'formatKg' | 'formatNumber'>;

/**
 * One line of the plates list (SPEC-v3 §2), e.g. `142.5 kg: 2 × 25 + 10 + 1.25 per side`,
 * `20 kg: bar only`, `15 kg: below the bar weight`, with `(0.5 kg cannot be loaded)` appended
 * when the available plates cannot reach the weight exactly.
 */
export function platesText(
  { t, formatKg, formatNumber }: Formatters,
  weightKg: number,
  barKg: number,
  availablePlatesKg: readonly number[],
): string {
  const kg = (value: number) => formatKg(value, { minimumFractionDigits: 0 });
  const weight = kg(weightKg);
  const result = platesPerSide(weightKg, barKg, availablePlatesKg);
  if (result.status === 'belowBar') return t('tools.platesBelowBar', { weight });

  const plates = result.plates
    .map(({ kg: plate, count }) =>
      count > 1 ? `${formatNumber(count)} × ${formatNumber(plate)}` : formatNumber(plate),
    )
    .join(' + ');
  const line =
    plates === '' ? t('tools.platesBarOnly', { weight }) : t('tools.platesPerSide', { weight, plates });
  return result.remainderKg > 0
    ? `${line} ${t('tools.platesRemainder', { weight: kg(result.remainderKg) })}`
    : line;
}
