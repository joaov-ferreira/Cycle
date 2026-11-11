import type { PrescribedSet } from '@/domain/prescription';
import type { I18nValue } from '@/i18n';

type Formatters = Pick<I18nValue, 't' | 'formatKg' | 'formatNumber'>;

/**
 * The load of a prescribed set as shown next to its row (SPEC-v4 §6.2): `75% → 75 kg`,
 * `70% +2.5 kg → 72.5 kg`, and exact → rounded when they differ (`72.5% → 74.31 → 75 kg`).
 * `null` when the set has no percent, no added kilograms and no load.
 */
export function prescribedSetText(
  { t, formatKg, formatNumber }: Formatters,
  set: Pick<PrescribedSet, 'percent' | 'addKg' | 'exactKg' | 'kg'>,
): string | null {
  const kg = (value: number) => formatKg(value, { minimumFractionDigits: 0 });
  const lead: string[] = [];
  if (set.percent !== null) lead.push(t('common.rxPercent', { percent: formatNumber(set.percent) }));
  if (set.addKg !== 0) {
    lead.push(t(set.addKg > 0 ? 'common.rxAddPlus' : 'common.rxAddMinus', { kg: kg(Math.abs(set.addKg)) }));
  }

  let load: string | null = null;
  if (set.kg !== null) {
    load = kg(set.kg);
    if (set.exactKg !== null && formatNumber(set.exactKg) !== formatNumber(set.kg)) {
      load = t('common.rxRounded', { exact: formatNumber(set.exactKg), load });
    }
  }

  const leadText = lead.join(' ');
  if (load === null) return leadText === '' ? null : leadText;
  return leadText === '' ? load : t('common.rxLoad', { lead: leadText, load });
}

/** `e1RM ≈ 96 kg`: the strength estimate with at most one decimal. */
export function e1rmText({ t, formatKg }: Pick<I18nValue, 't' | 'formatKg'>, kg: number): string {
  return t('common.e1rmLine', { kg: formatKg(kg, { minimumFractionDigits: 0, maximumFractionDigits: 1 }) });
}
