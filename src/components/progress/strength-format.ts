/**
 * Display helpers for strength features (SPEC-v4), shared by Progress, Home, the cycle report and
 * History: program text in the UI locale, signed kg and percent, the origin of a prescription and
 * its compact `3×5 @ 75 kg` summary, effort in the profile's scale.
 */
import { useCallback, useMemo } from 'react';

import type { ProgramText } from '@/domain/program';
import type { Prescription, PrescribedSet } from '@/domain/prescription';
import { rpeFromRir } from '@/domain/effort';
import type { ReferenceMaxOrigin } from '@/domain/reference-max';
import { useI18n, type MessageKey } from '@/i18n';
import { findProgram } from '@/library';
import { selectEffortScale, useAppStore } from '@/state';

const ORIGIN_KEYS: Record<ReferenceMaxOrigin, MessageKey> = {
  manual: 'strength.origin.manual',
  fromE1rm: 'strength.origin.fromE1rm',
  onboarding: 'strength.origin.onboarding',
  import: 'strength.origin.import',
  v1: 'strength.origin.v1',
};

const GRAMS_PER_KG = 1000;
const MINUS = '−';

/** `pt-BR` text when the locale is pt-BR and it exists, else English. */
export function programTextIn(text: ProgramText, locale: 'en' | 'pt-BR'): string {
  return locale === 'pt-BR' ? (text['pt-BR'] ?? text.en) : text.en;
}

/** Name of a program (a proper name, the same in every locale); the id when the program is unknown. */
export function programNameOf(programId: string): string {
  return findProgram(programId)?.name ?? programId;
}

/** Groups consecutive prescribed sets with the same reps, load and AMRAP flag. */
export function groupPrescribedSets(sets: readonly PrescribedSet[]): { set: PrescribedSet; count: number }[] {
  const groups: { set: PrescribedSet; count: number }[] = [];
  for (const set of sets) {
    const last = groups[groups.length - 1];
    if (last && last.set.reps === set.reps && last.set.kg === set.kg && last.set.amrap === set.amrap) {
      last.count += 1;
    } else {
      groups.push({ set, count: 1 });
    }
  }
  return groups;
}

export type StrengthFormat = {
  locale: 'en' | 'pt-BR';
  /** `107.7 kg`: at most `digits` decimals (default 1). */
  kg: (value: number, digits?: number) => string;
  /** `+2.7 kg`, `−1 kg`, `0 kg` (true minus sign). */
  signedKg: (value: number, digits?: number) => string;
  /** `+2.54 %`, `−1.5 %`. */
  signedPercent: (value: number) => string;
  text: (text: ProgramText) => string;
  programName: (programId: string) => string;
  /** `Smolov Jr. · week 2 · day 1` or `Percent of 1RM · week 2`. */
  origin: (source: Prescription['source']) => string;
  originOfMax: (origin: ReferenceMaxOrigin) => string;
  /** `3×5 @ 75 kg, 1×5+ @ 80 kg`; the load is `—` while the 1RM is missing. */
  prescription: (sets: readonly PrescribedSet[]) => string;
  /** The effort of a logged set in the profile's scale: `RIR 2` or `RPE 8`. */
  effort: (rir: number) => string;
};

export function useStrengthFormat(): StrengthFormat {
  const { t, locale, formatKg, formatNumber } = useI18n();
  const scale = useAppStore(selectEffortScale);

  const kg = useCallback(
    (value: number, digits = 1) => formatKg(value, { minimumFractionDigits: 0, maximumFractionDigits: digits }),
    [formatKg],
  );
  const sign = (grams: number) => (grams > 0 ? '+' : grams < 0 ? MINUS : '');

  return useMemo<StrengthFormat>(
    () => ({
      locale,
      kg,
      signedKg: (value, digits = 1) => {
        const grams = Math.round(value * GRAMS_PER_KG);
        return `${sign(grams)}${kg(Math.abs(grams) / GRAMS_PER_KG, digits)}`;
      },
      signedPercent: (value) => {
        const hundredths = Math.round(value * 100);
        return t('strength.percent', {
          value: `${sign(hundredths)}${formatNumber(Math.abs(hundredths) / 100, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
        });
      },
      text: (text) => programTextIn(text, locale),
      programName: programNameOf,
      origin: (source) =>
        source.kind === 'program'
          ? t('strength.source.program', {
              program: programNameOf(source.programId),
              week: source.programWeek,
              day: source.day,
            })
          : t('strength.source.scheme', { week: source.schemeWeek }),
      originOfMax: (origin) => t(ORIGIN_KEYS[origin]),
      prescription: (sets) =>
        groupPrescribedSets(sets)
          .map(({ set, count }) =>
            t(set.amrap ? 'strength.prescription.amrapGroup' : 'strength.prescription.group', {
              sets: count,
              reps: set.reps,
              load: set.kg === null ? t('strength.prescription.noLoad') : kg(set.kg, 2),
            }),
          )
          .join(', '),
      effort: (rir) =>
        scale === 'rpe'
          ? t('history.rpe', { value: formatNumber(rpeFromRir(rir), { maximumFractionDigits: 1 }) })
          : t('history.rir', { rir: formatNumber(rir, { maximumFractionDigits: 1 }) }),
    }),
    [locale, kg, t, formatNumber, scale],
  );
}
