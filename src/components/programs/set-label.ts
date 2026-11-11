/**
 * Display text of program data: the language of a `ProgramText` and the `sets × reps @ %` label
 * shared by the program detail and the import preview.
 */
import { useCallback } from 'react';

import type { ProgramText } from '@/domain/program';
import { useI18n, type AppLocale } from '@/i18n';

/** `pt-BR` when present and the UI is Portuguese, else the English original. */
export function programText(text: ProgramText, locale: AppLocale): string {
  return locale === 'pt-BR' ? (text['pt-BR'] ?? text.en) : text.en;
}

/** `ProgramText` in the current UI language. */
export function useProgramText(): (text: ProgramText) => string {
  const { locale } = useI18n();
  return useCallback((text) => programText(text, locale), [locale]);
}

/** What is added after the percentage: fixed kilograms, or an increment parameter (× `times`). */
export type SetAddition =
  | { kind: 'kg'; kg: number }
  | { kind: 'param'; label: string; times: number };

export type SetGroup = {
  /** Number of identical sets. */
  sets: number;
  reps: number;
  /** Percent of the 1RM in percentage points (75 = 75 %); absent: no load. */
  percent?: number;
  amrap?: boolean;
  add?: SetAddition;
};

/** `3 × 5 @ 75 %`, `1 × 5+ @ 85 % AMRAP`, `6 × 6 @ 70 % + 2 × Weekly increment`. */
export function useSetLabel(): (group: SetGroup) => string {
  const { t, formatNumber, formatKg } = useI18n();
  return useCallback(
    ({ sets, reps, percent, amrap, add }) => {
      const repsText = amrap ? t('programs.set.amrapReps', { reps: formatNumber(reps) }) : formatNumber(reps);
      let label = t('programs.set.base', { sets: formatNumber(sets), reps: repsText });
      if (percent !== undefined) label = t('programs.set.percent', { label, percent: formatNumber(percent) });
      if (add?.kind === 'kg' && add.kg > 0) label = t('programs.set.addKg', { label, kg: formatKg(add.kg) });
      else if (add?.kind === 'kg' && add.kg < 0) label = t('programs.set.subKg', { label, kg: formatKg(-add.kg) });
      else if (add?.kind === 'param') {
        label =
          add.times === 1
            ? t('programs.set.addParam', { label, param: add.label })
            : t('programs.set.addParamTimes', { label, times: formatNumber(add.times), param: add.label });
      }
      return amrap ? t('programs.set.amrap', { label }) : label;
    },
    [t, formatNumber, formatKg],
  );
}
