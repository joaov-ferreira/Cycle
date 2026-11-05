/**
 * Shared building blocks of the numbered Sheiko templates (SPEC §3.3-D). Each template lives in
 * its own file (`sheiko-<number>.ts`); this module only holds the common source, names and
 * helpers. Sources and transcription notes: docs/DECISIONS.md, Stage 9.
 */
import type { Lift } from '@/domain/lifts';

import type {
  AccessoryItem,
  InfoItem,
  LocalizedText,
  MainItem,
  PrescriptionItem,
  ProgramDay,
  ProgramTemplate,
  ProgramWeek,
  SetPrescription,
} from '../schema';

export const SHEIKO_ACCESSED = '2026-11-05';

/** Lift Vault's collection of the numbered routines (Google Sheets, one tab per routine). */
export const SHEIKO_COLLECTION_URL =
  'https://docs.google.com/spreadsheets/d/1vBdL47glReiNALmFw1_ieRg6nMYaJ5OFlmidJ9nUNNM/edit';
export const SHEIKO_LIFTVAULT_PAGE = 'https://liftvault.com/programs/powerlifting/sheiko-spreadsheets/';
export const SHEIKO_UNDER_80_URL =
  'https://docs.google.com/spreadsheets/d/12VzUk4JAWHulBnYfJIo4-JUAEe9yBxD6F5hy1jw9eKk/edit';
export const LIFTOSAUR_29_32_URL = 'https://www.liftosaur.com/programs/sheiko-29-32';

/** `sets × reps @ percent` (one set when `repeat` is 1); percentages refer to the competition 1RM. */
export const s = (repeat: number, reps: number, percent: number): SetPrescription =>
  repeat === 1 ? { reps, percent } : { repeat, reps, percent };

/** The competition lift itself. */
export const main = (lift: Lift, ...sets: SetPrescription[]): MainItem => ({ kind: 'main', lift, sets });

/** Variations prescribed as a percentage of the competition lift's 1RM (as in the source spreadsheet). */
export const VARIATION = {
  deadliftToKnees: { en: 'Deadlift up to knees', 'pt-BR': 'Levantamento terra até os joelhos' },
  deadliftFromBoxes: { en: 'Deadlift from boxes', 'pt-BR': 'Levantamento terra a partir de blocos' },
  deficitDeadlift: { en: 'Deficit deadlift', 'pt-BR': 'Levantamento terra em déficit' },
  frontSquat: { en: 'Front squat', 'pt-BR': 'Agachamento frontal' },
} satisfies Record<string, LocalizedText>;

export const variation = (lift: Lift, exercise: LocalizedText, ...sets: SetPrescription[]): MainItem => ({
  kind: 'main',
  lift,
  exercise,
  sets,
});

/** Accessory names as the source spells them (displayed, never calculated). */
export const ACCESSORY = {
  dumbbellFly: { en: 'Dumbbell fly', 'pt-BR': 'Crucifixo com halteres' },
  goodMorningStanding: { en: 'Good morning (standing)', 'pt-BR': 'Bom-dia (em pé)' },
  goodMorningSitting: { en: 'Good morning (sitting)', 'pt-BR': 'Bom-dia (sentado)' },
  inclineBench: { en: 'Incline bench press', 'pt-BR': 'Supino inclinado' },
  dip: { en: 'Dip', 'pt-BR': 'Mergulho nas paralelas' },
  lunge: { en: 'Lunge', 'pt-BR': 'Avanço' },
  abs: { en: 'Abs', 'pt-BR': 'Abdominais' },
  pushUp: { en: 'Push up', 'pt-BR': 'Flexão de braços' },
  press: { en: 'Press', 'pt-BR': 'Desenvolvimento' },
  frenchPress: { en: 'French press', 'pt-BR': 'Tríceps francês' },
  triceps: { en: 'Triceps', 'pt-BR': 'Tríceps' },
  legPress: { en: 'Leg press', 'pt-BR': 'Leg press' },
  backExtension: { en: 'Back extension', 'pt-BR': 'Extensão lombar' },
} satisfies Record<string, LocalizedText>;

/** An accessory with the source's sets and reps (no weight is prescribed). */
export const acc = (name: LocalizedText, sets: number, reps: number): AccessoryItem => ({
  kind: 'accessory',
  name,
  text: { en: `${sets} sets × ${reps} reps`, 'pt-BR': `${sets} séries × ${reps} repetições` },
});

/**
 * #32 week 1, Wednesday: after the 90% single, the sources disagree on the attempts, so they are
 * shown as text without a load.
 */
export const maxAttempts = (lift: Lift): InfoItem => ({
  kind: 'info',
  lift,
  text: {
    en: 'Max attempts: 2–3 singles at 100–105% of 1RM.',
    'pt-BR': 'Tentativas máximas: 2–3 repetições únicas a 100–105% do 1RM.',
  },
  unverified: true,
  note: {
    en:
      'The adopted spreadsheet and the under-80 kg workbook give a range (2–3 × 1 @ 100–105%); ' +
      'Liftosaur gives 3 × 1 @ 100%. No single set count or percentage, so no load is calculated.',
    'pt-BR':
      'A planilha adotada e a planilha para menos de 80 kg dão uma faixa (2–3 × 1 @ 100–105%); ' +
      'o Liftosaur dá 3 × 1 @ 100%. Sem número de séries ou percentual único, nenhuma carga é calculada.',
  },
});

/** #32 week 4: the last days of the month are the competition (or test). */
export const COMPETITION: InfoItem = {
  kind: 'info',
  text: {
    en: 'Competition (or max test): no sets prescribed.',
    'pt-BR': 'Competição (ou teste de máximo): sem séries prescritas.',
  },
};

const WEEKDAYS: readonly LocalizedText[] = [
  { en: 'Monday', 'pt-BR': 'Segunda-feira' },
  { en: 'Wednesday', 'pt-BR': 'Quarta-feira' },
  { en: 'Friday', 'pt-BR': 'Sexta-feira' },
];

/** The source's "5-6-7 day" of #32 week 4 (the competition days). */
export const DAYS_5_TO_7: LocalizedText = { en: 'Days 5–7', 'pt-BR': 'Dias 5–7' };

/** One day of the source: its items, labelled Monday / Wednesday / Friday unless told otherwise. */
export type SheikoDay = PrescriptionItem[] | { label: LocalizedText; items: PrescriptionItem[] };

function toWeek(days: readonly SheikoDay[], index: number): ProgramWeek {
  return {
    week: index + 1,
    days: days.map(
      (day, d): ProgramDay =>
        Array.isArray(day) ? { day: d + 1, label: WEEKDAYS[d], items: day } : { day: d + 1, ...day },
    ),
  };
}

type SheikoDefinition = {
  number: number;
  /** Second transcriptions the template was checked against, with their URLs. */
  crossChecks: string;
  weeks: readonly (readonly SheikoDay[])[];
};

/** A numbered Sheiko routine: one month (4 weeks), three days a week, all three lifts. */
export function sheikoTemplate({ number, crossChecks, weeks }: SheikoDefinition): ProgramTemplate {
  return {
    id: `sheiko-${number}`,
    family: 'sheiko',
    name: `Sheiko #${number}`,
    variant: `#${number}`,
    version: `Sheiko #${number} (monthly plan, ChaseT spreadsheet 2008) — transcription v1`,
    source: {
      author: 'Attributed to Boris Sheiko; spreadsheet by “ChaseT” (2008-05-09); no primary text by Sheiko located',
      reference: `Lift Vault, “Sheiko Program Spreadsheets” (Google Sheets), tab “#${number}” (“Monthly training plan #${number}”)`,
      url: SHEIKO_COLLECTION_URL,
      accessedAt: SHEIKO_ACCESSED,
      notes:
        `Listed on ${SHEIKO_LIFTVAULT_PAGE}. Percentages are of the competition 1RM of each lift ` +
        '(the spreadsheet multiplies them by the squat, bench or deadlift max, variations included). ' +
        `${crossChecks} Accessories have sets and reps only (no weight in the source). ` +
        'The sheiko-program.ru forum the spreadsheets cite now serves unrelated content.',
    },
    verification: 'partial',
    durationWeeks: weeks.length,
    daysPerWeek: 3,
    allowedLifts: ['bench', 'squat', 'deadlift'],
    liftSelectable: true,
    weeks: weeks.map(toWeek),
  };
}
