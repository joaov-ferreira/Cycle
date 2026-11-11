/**
 * Display text of prescriptions and program labels shared by the plan screen and the periodization
 * table. Everything goes through the i18n value; the domain only supplies numbers and codes.
 */
import type { PrescribedSet, Prescription } from '@/domain/prescription';
import type { ProgramText } from '@/domain/program';
import type { AppLocale, I18nValue } from '@/i18n';

/** Program data text in the UI language: `pt-BR` when present and wanted, else English. */
export function localText(text: ProgramText, locale: AppLocale): string {
  return (locale === 'pt-BR' ? text['pt-BR'] : undefined) ?? text.en;
}

type Group = { count: number; set: PrescribedSet };

const sameSet = (a: PrescribedSet, b: PrescribedSet): boolean =>
  a.reps === b.reps &&
  a.amrap === b.amrap &&
  a.unverified === b.unverified &&
  a.percent === b.percent &&
  a.addKg === b.addKg &&
  a.exactKg === b.exactKg &&
  a.kg === b.kg;

/** Consecutive identical sets folded into one group (`6 × 6 @ 70 %`). */
export function groupSets(sets: readonly PrescribedSet[]): Group[] {
  const groups: Group[] = [];
  for (const set of sets) {
    const last = groups[groups.length - 1];
    if (last && sameSet(last.set, set)) last.count += 1;
    else groups.push({ count: 1, set });
  }
  return groups;
}

export type LineOptions = {
  /** Tighter percent notation for table cells (`@70 %`). */
  compact?: boolean;
};

/**
 * One line per group of identical sets: `3×5 @ 75 % → 75 kg`, `3×5 @ 75 % → 78.75 → 77.5 kg`
 * (exact → rounded when they differ), `3×5 @ 75 % → — (1RM needed)` without a load; AMRAP and
 * unverified sets are marked.
 */
export function prescriptionLines(
  i18n: I18nValue,
  prescription: Prescription,
  options: LineOptions = {},
): string[] {
  const { t, formatNumber, formatKg } = i18n;
  const kg = (value: number) => formatKg(Math.abs(value), { minimumFractionDigits: 0 });
  return groupSets(prescription.sets).map(({ count, set }) => {
    const reps = set.amrap ? t('plan.rx.amrapReps', { reps: formatNumber(set.reps) }) : formatNumber(set.reps);
    const sets = t('plan.rx.sets', { count: formatNumber(count), reps });
    let percent = '';
    if (set.percent !== null) {
      percent = t(options.compact ? 'plan.rx.percentCompact' : 'plan.rx.percent', {
        percent: formatNumber(set.percent),
      });
      if (set.addKg !== 0) {
        percent += t('plan.rx.addKg', { sign: set.addKg < 0 ? '−' : '+', kg: kg(set.addKg) });
      }
    }
    let load: string;
    if (set.kg === null) {
      const reason = prescription.basisKg === null ? t('plan.rx.needsMax') : t('plan.rx.noPercent');
      load = t('plan.rx.noLoad', { reason });
    } else if (set.exactKg !== null && set.exactKg !== set.kg) {
      load = t('plan.rx.exactRounded', { exact: formatNumber(set.exactKg), rounded: kg(set.kg) });
    } else {
      load = kg(set.kg);
    }
    const marks = [set.amrap ? t('plan.rx.amrap') : null, set.unverified ? t('plan.rx.unverified') : null];
    return [t('plan.rx.line', { sets, percent, load }), ...marks].filter((part) => part !== null).join(' · ');
  });
}

/** `3 × 8–12`, or `3 × 10` when the range is a single value. */
export function targetText(i18n: I18nValue, sets: number, repMin: number, repMax: number): string {
  const { t, formatNumber } = i18n;
  const reps =
    repMin === repMax
      ? formatNumber(repMin)
      : t('plan.repRange', { min: formatNumber(repMin), max: formatNumber(repMax) });
  return t('plan.target', { sets: formatNumber(sets), reps });
}

/** `RIR 2`, or `RPE 8` when the profile reads effort as RPE. */
export function effortText(i18n: I18nValue, rir: number, scale: 'rir' | 'rpe'): string {
  const { t, formatNumber } = i18n;
  return scale === 'rpe'
    ? t('plan.rx.rpe', { value: formatNumber(10 - rir) })
    : t('plan.targetRir', { value: formatNumber(rir) });
}
