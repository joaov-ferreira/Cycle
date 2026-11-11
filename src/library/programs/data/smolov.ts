import type {
  ProgramDay,
  ProgramItem,
  ProgramSet,
  ProgramTemplate,
  ProgramText,
  ProgramWeek,
} from '../../../domain/program';
import { s, SQUAT_ROLE, type InfoItem } from '../helpers';

const ACCESSED = '2026-11-05';
const PRIMARY_URL = 'https://www.smolovjr.com/smolov-squat-routine';

const PHASES = {
  intro: { en: 'Introductory microcycle', 'pt-BR': 'Microciclo introdutório' },
  base: { en: 'Base mesocycle', 'pt-BR': 'Mesociclo de base' },
  switching: { en: 'Switching phase', 'pt-BR': 'Fase de transição' },
  intense: { en: 'Intense mesocycle', 'pt-BR': 'Mesociclo intenso' },
  taper: { en: 'Taper and test', 'pt-BR': 'Polimento e teste' },
} satisfies Record<string, ProgramText>;

const BASE_DAYS: readonly ProgramText[] = [
  { en: 'Monday', 'pt-BR': 'Segunda-feira' },
  { en: 'Wednesday', 'pt-BR': 'Quarta-feira' },
  { en: 'Friday', 'pt-BR': 'Sexta-feira' },
  { en: 'Saturday', 'pt-BR': 'Sábado' },
];

const REST: InfoItem = {
  kind: 'info',
  text: {
    en: 'Rest day: the original program has no squat session on this day.',
    'pt-BR': 'Dia de descanso: o programa original não tem sessão de agachamento neste dia.',
  },
};

const test = (note: ProgramText): InfoItem => ({
  kind: 'info',
  role: 'squat',
  text: {
    en: '1RM test: work up to a new one-rep max in single attempts (no percentage prescribed).',
    'pt-BR': 'Teste de 1RM: suba em tentativas únicas até um novo máximo (sem percentual prescrito).',
  },
  note,
});

const BASE_TEST = test({
  en: 'Test once, on Friday or Saturday. The new 1RM is the basis of the intense mesocycle.',
  'pt-BR': 'Teste uma vez, na sexta-feira ou no sábado. O novo 1RM é a base do mesociclo intenso.',
});

const FINAL_TEST = test({ en: 'Final test after the taper.', 'pt-BR': 'Teste final após o polimento.' });

const SWITCHING: InfoItem = {
  kind: 'info',
  role: 'squat',
  text: {
    en: 'Switching phase: light, explosive squat work (speed squats, box squats, negatives).',
    'pt-BR': 'Fase de transição: agachamento leve e explosivo (agachamento de velocidade, no banco, negativas).',
  },
  unverified: true,
  note: {
    en:
      'No sets, reps, percentages or frequency confirmed. Most sources give no fixed prescription ' +
      '(smolovjr.com, Lift Vault, My Training Guide, Legion: speed work at about 50–60%, up to 70%); ' +
      'Hunt Fitness (3 × 5 to 1 × 5 @ 75–82.5%) and Liftosaur (6 × 2 to 4 × 2 @ 50–60%) disagree.',
    'pt-BR':
      'Séries, repetições, percentuais e frequência não confirmados. A maioria das fontes não dá uma ' +
      'prescrição fixa (smolovjr.com, Lift Vault, My Training Guide, Legion: velocidade a cerca de 50–60%, ' +
      'até 70%); Hunt Fitness (3 × 5 a 1 × 5 @ 75–82,5%) e Liftosaur (6 × 2 a 4 × 2 @ 50–60%) divergem.',
  },
};

const BASE_NOTE: ProgramText = {
  en: 'Skip the increment if sets of the previous week were missed.',
  'pt-BR': 'Não aplique o incremento se houve séries falhadas na semana anterior.',
};

const NEW_1RM: ProgramText = {
  en: 'Percentages of the new 1RM tested in week 6: update the reference 1RM.',
  'pt-BR': 'Percentuais do novo 1RM testado na semana 6: atualize o 1RM de referência.',
};

const TAPER_NOTE: ProgramText = {
  en: `${NEW_1RM.en} My Training Guide recommends a lighter taper for most lifters (1 × 4 @ 75%, 1 × 5 @ 85%, then the test).`,
  'pt-BR': `${NEW_1RM['pt-BR']} O My Training Guide recomenda um polimento mais leve para a maioria (1 × 4 @ 75%, 1 × 5 @ 85% e o teste).`,
};

const disputed = (repeat: number, reps: number, readings: ProgramText): ProgramSet => ({
  ...(repeat === 1 ? {} : { repeat }),
  reps,
  unverified: true,
  note: readings,
});

const squat = (sets: ProgramSet[], note?: ProgramText): ProgramItem => ({
  kind: 'main',
  role: 'squat',
  sets,
  ...(note ? { note } : {}),
});

function week(n: number, phase: ProgramText, days: ProgramItem[], labels?: readonly ProgramText[]): ProgramWeek {
  return {
    week: n,
    phase,
    days: days.map(
      (it, index): ProgramDay => ({ day: index + 1, ...(labels ? { label: labels[index] } : {}), items: [it] }),
    ),
  };
}

const INTRO_EASY = [s(3, 8, 0.65), s(1, 5, 0.7), s(2, 2, 0.75), s(1, 1, 0.8)];
const BASE = [s(4, 9, 0.7), s(5, 7, 0.75), s(7, 5, 0.8), s(10, 3, 0.85)];

const baseWeek = (n: number, kg?: number) =>
  week(
    n,
    PHASES.base,
    BASE.map((set) => (kg === undefined ? squat([set]) : squat([{ ...set, addKg: { kg } }], BASE_NOTE))),
    BASE_DAYS,
  );

const intense = (n: number, days: ProgramSet[][]) =>
  week(n, PHASES.intense, [...days.map((sets) => squat(sets, NEW_1RM)), REST]);

/**
 * Smolov (SPEC §3.3-B): the full 13-week squat program — introductory microcycle (weeks 1–2),
 * base mesocycle (3–6, with fixed +10 kg / +15 kg increments and a 1RM test), switching phase
 * (7–8, unverified), intense mesocycle (9–12) and taper/test (13). Every week has four day slots;
 * a week with three sessions has a rest day. Transcription and source discussion:
 * docs/DECISIONS.md, Stage 8.
 */
export const smolov: ProgramTemplate = {
  id: 'smolov',
  family: 'smolov',
  name: 'Smolov',
  version: 'Smolov squat routine (13 weeks, consensus of secondary sources) — transcription v1',
  source: {
    author: 'Sergey Y. Smolov (intense mesocycle attributed to I. M. Feduleyev); introduced in English by Pavel Tsatsouline',
    reference: 'smolovjr.com, “Smolov Squat Routine” (HeavyDuty.com)',
    url: PRIMARY_URL,
    accessedAt: ACCESSED,
    notes:
      'No primary text by Smolov was retrieved (Tsatsouline’s “Another Russian Super Cycle” on dragondoor.com ' +
      'and its reprint on ontariostrongman.ca were unreachable). Cross-checked on ' +
      ACCESSED +
      ' with kylehuntfitness.com (K. Hunt, 2024), mytrainingguide.blogspot.com (2015), gigasnutrition.com, ' +
      'liftosaur.com/programs/smolov-squat, justintadlock.com (intro and base, 2011) and liftvault.com. ' +
      'Base increments: +20 lb / 10 kg in week 4 and +30 lb / 15 kg over week 3 in week 5 (Tadlock, Gigas). ' +
      'Unverified: the switching phase (no consistent prescription), the last set of week 9 day 1 ' +
      '(85% vs 90%) and of week 12 day 3 (95% vs 80%).',
  },
  verification: 'partial',
  durationWeeks: 13,
  daysPerWeek: 4,
  roles: [{ ...SQUAT_ROLE, fixedInOriginal: true }],
  weeks: [
    week(1, PHASES.intro, [
      squat(INTRO_EASY),
      squat(INTRO_EASY),
      squat([s(4, 5, 0.7), s(1, 3, 0.75), s(2, 2, 0.8), s(1, 1, 0.9)]),
      REST,
    ]),
    week(2, PHASES.intro, [squat([s(1, 5, 0.8)]), squat([s(1, 5, 0.825)]), squat([s(1, 5, 0.85)]), REST]),
    baseWeek(3),
    baseWeek(4, 10),
    baseWeek(5, 15),
    week(6, PHASES.base, [REST, REST, BASE_TEST, BASE_TEST], BASE_DAYS),
    week(7, PHASES.switching, [SWITCHING, SWITCHING, SWITCHING, SWITCHING]),
    week(8, PHASES.switching, [SWITCHING, SWITCHING, SWITCHING, SWITCHING]),
    intense(9, [
      [
        s(1, 3, 0.65),
        s(1, 4, 0.75),
        s(3, 4, 0.85),
        disputed(1, 5, {
          en: 'Sources disagree: 85% (smolovjr.com, Hunt Fitness) or 90% (Liftosaur, My Training Guide, Gigas Nutrition).',
          'pt-BR': 'As fontes divergem: 85% (smolovjr.com, Hunt Fitness) ou 90% (Liftosaur, My Training Guide, Gigas Nutrition).',
        }),
      ],
      [s(1, 3, 0.6), s(1, 3, 0.7), s(1, 4, 0.8), s(1, 3, 0.9), s(2, 5, 0.85)],
      [s(1, 4, 0.65), s(1, 4, 0.7), s(5, 4, 0.8)],
    ]),
    intense(10, [
      [s(1, 4, 0.6), s(1, 4, 0.7), s(1, 4, 0.8), s(1, 3, 0.9), s(2, 4, 0.9)],
      [s(1, 3, 0.65), s(1, 3, 0.75), s(1, 3, 0.85), s(3, 3, 0.9), s(1, 3, 0.95)],
      [s(1, 3, 0.65), s(1, 3, 0.75), s(1, 4, 0.85), s(4, 5, 0.9)],
    ]),
    intense(11, [
      [s(1, 3, 0.6), s(1, 3, 0.7), s(1, 3, 0.8), s(5, 5, 0.9)],
      [s(1, 3, 0.6), s(1, 3, 0.7), s(1, 3, 0.8), s(2, 3, 0.95)],
      [s(1, 3, 0.65), s(1, 3, 0.75), s(1, 3, 0.85), s(4, 3, 0.95)],
    ]),
    intense(12, [
      [s(1, 3, 0.7), s(1, 4, 0.8), s(5, 5, 0.9)],
      [s(1, 3, 0.7), s(1, 3, 0.8), s(4, 3, 0.95)],
      [
        s(1, 3, 0.75),
        s(1, 4, 0.9),
        disputed(3, 4, {
          en: 'Sources disagree: 95% (smolovjr.com, Hunt Fitness) or 80% (Liftosaur, My Training Guide, Gigas Nutrition).',
          'pt-BR': 'As fontes divergem: 95% (smolovjr.com, Hunt Fitness) ou 80% (Liftosaur, My Training Guide, Gigas Nutrition).',
        }),
      ],
    ]),
    week(13, PHASES.taper, [
      squat([s(1, 3, 0.7), s(1, 3, 0.8), s(2, 5, 0.9), s(3, 4, 0.95)], TAPER_NOTE),
      squat([s(1, 4, 0.75), s(4, 4, 0.85)], NEW_1RM),
      FINAL_TEST,
      REST,
    ]),
  ],
};
