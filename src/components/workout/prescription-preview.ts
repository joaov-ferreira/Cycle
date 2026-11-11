import type { PrescribedSet, Prescription } from '@/domain/prescription';
import type { I18nValue } from '@/i18n';

type Formatters = Pick<I18nValue, 't' | 'formatKg' | 'formatNumber'>;

const sameGroup = (a: PrescribedSet, b: PrescribedSet): boolean =>
  a.reps === b.reps && a.amrap === b.amrap && a.kg === b.kg && a.percent === b.percent && a.unverified === b.unverified;

/**
 * The compact prescription of the start view (SPEC-v4 §7): identical consecutive sets are grouped,
 * `3×5 @ 75 kg, 1×1+ @ 95 kg`. A set without a load shows its percent (`1×5 @ 80%`) or only the reps.
 */
export function prescriptionPreview({ t, formatKg, formatNumber }: Formatters, prescription: Prescription): string {
  const groups: { set: PrescribedSet; count: number }[] = [];
  for (const set of prescription.sets) {
    const last = groups[groups.length - 1];
    if (last && sameGroup(last.set, set)) last.count += 1;
    else groups.push({ set, count: 1 });
  }
  return groups
    .map(({ set, count }) => {
      const reps = set.amrap ? t('common.repsAmrap', { reps: set.reps }) : String(set.reps);
      const sets = t('workout.previewSets', { sets: count, reps });
      if (set.kg !== null) return t('workout.previewAt', { sets, load: formatKg(set.kg, { minimumFractionDigits: 0 }) });
      if (set.percent !== null) {
        return t('workout.previewAt', { sets, load: t('common.rxPercent', { percent: formatNumber(set.percent) }) });
      }
      return sets;
    })
    .join(', ');
}
