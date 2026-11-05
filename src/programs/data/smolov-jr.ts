import type { LocalizedText, ProgramTemplate, ProgramWeek, SetPrescription } from '../schema';

const ACCESSED = '2026-11-05';
const PRIMARY_URL = 'https://www.smolovjr.com/smolov-squat-program';
const INCREMENT = 'weeklyIncrementKg';

/** Week 1 of the source table: sets × reps @ % of 1RM, Monday / Wednesday / Friday / Saturday. */
const DAYS: readonly { repeat: number; reps: number; percent: number; label: LocalizedText }[] = [
  { repeat: 6, reps: 6, percent: 0.7, label: { en: 'Monday', 'pt-BR': 'Segunda-feira' } },
  { repeat: 7, reps: 5, percent: 0.75, label: { en: 'Wednesday', 'pt-BR': 'Quarta-feira' } },
  { repeat: 8, reps: 4, percent: 0.8, label: { en: 'Friday', 'pt-BR': 'Sexta-feira' } },
  { repeat: 10, reps: 3, percent: 0.85, label: { en: 'Saturday', 'pt-BR': 'Sábado' } },
];

/** Week `n`: the week 1 sets plus `n − 1` weekly increments (week 2 + inc, week 3 + 2 × inc). */
function week(n: 1 | 2 | 3): ProgramWeek {
  return {
    week: n,
    days: DAYS.map(({ label, ...set }, index) => {
      const prescription: SetPrescription =
        n === 1 ? { ...set } : { ...set, addKg: n === 2 ? { param: INCREMENT } : { param: INCREMENT, times: 2 } };
      return {
        day: index + 1,
        label,
        items: [{ kind: 'main' as const, lift: 'selected' as const, sets: [prescription] }],
      };
    }),
  };
}

/**
 * Smolov Jr. (SPEC §3.3-C): three weeks of the same four days (6×6 @70 %, 7×5 @75 %, 8×4 @80 %,
 * 10×3 @85 %), with an absolute increment added in week 2 and twice that in week 3.
 * Transcription and source discussion: docs/DECISIONS.md, Stage 7.
 */
export const smolovJr: ProgramTemplate = {
  id: 'smolov-jr',
  family: 'smolov-jr',
  name: 'Smolov Jr.',
  version: 'Smolov Jr. (3-week base, consensus of secondary sources) — transcription v1',
  source: {
    author: 'Attributed to Sergey Smolov; no primary text by Smolov was located',
    reference: 'smolovjr.com, “Smolov Jr. Program” (HeavyDuty.com, 2017)',
    url: PRIMARY_URL,
    accessedAt: ACCESSED,
    notes:
      'Sets, reps and percentages agree in every source consulted on ' +
      ACCESSED +
      ': smolovjr.com; liftvault.com/programs/powerlifting/smolov/ (citing PowerliftingToWin); ' +
      'fitnessvolt.com/smolov-jr-program/; legionathletics.com/smolov-jr-calculator/; ' +
      'liftosaur.com/programs/smolov-jr. Increments: week 2 = week 1 + 5–10 lb, week 3 = week 1 + 10–20 lb ' +
      '(smolovjr.com, Lift Vault, FitnessVolt, Legion); in kilograms 2.5–5 kg per week, cumulative ' +
      '(norma-athletics.at/guides/smolov-jr/, lift5x5.app/blog/smolov-jr). No source consulted gives ' +
      'separate upper- and lower-body ranges, so one range applies to bench and squat. ' +
      'Days follow the sources’ Monday / Wednesday / Friday / Saturday schedule.',
  },
  verification: 'partial',
  durationWeeks: 3,
  daysPerWeek: 4,
  allowedLifts: ['bench', 'squat'],
  liftSelectable: true,
  configurable: [
    {
      id: INCREMENT,
      label: { en: 'Weekly increment', 'pt-BR': 'Incremento semanal' },
      unit: 'kg',
      min: 2.5,
      max: 5,
      step: 0.5,
      default: 2.5,
      source:
        'smolovjr.com (week 2 + 5–10 lb, week 3 + 10–20 lb); 2.5–5 kg per week per NORMA Athletics and ' +
        'Lift5x5 (accessed 2026-11-05). Default: the lower end, which Lift5x5 recommends unless week 1 felt easy. ' +
        'The 0.5 kg step is a CYCLE input granularity, not part of the source.',
    },
  ],
  weeks: [week(1), week(2), week(3)],
};
