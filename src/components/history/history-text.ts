import type { ActualGroup, PrescribedGroup } from '@/domain/history';
import { useI18n } from '@/i18n';

/** Localized compact summaries of the sets of a session (history list and detail). */
export function useHistoryText() {
  const { t, formatKg, formatNumber } = useI18n();
  return {
    /** `3×5 @ 75.0 kg, 1×3 @ 85.0 kg` */
    prescribed: (groups: readonly PrescribedGroup[]) =>
      groups
        .map((group) =>
          group.weightKg === null
            ? t('history.group.prescribedNoLoad', { count: group.count, reps: group.reps })
            : t('history.group.prescribed', { count: group.count, reps: group.reps, load: formatKg(group.weightKg) }),
        )
        .join(', '),
    /** `2 × 75.0 kg × 5; 80.0 kg × 5 · RIR 1 · RPE 9` */
    performed: (groups: readonly ActualGroup[]) =>
      groups
        .map((group) => {
          const set = [
            t('performance.performed', { weight: formatKg(group.weightKg), reps: formatNumber(group.reps) }),
            ...(group.rir === null ? [] : [t('performance.rirLabel', { value: formatNumber(group.rir) })]),
            ...(group.rpe === null ? [] : [t('performance.rpeLabel', { value: formatNumber(group.rpe) })]),
          ].join(' · ');
          return group.count > 1 ? t('history.group.repeat', { count: group.count, set }) : set;
        })
        .join('; '),
  };
}
