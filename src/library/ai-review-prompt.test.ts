import fs from 'fs';
import path from 'path';
import type { Exercise } from '../domain/exercise';
import { aiPlanPromptOutputSection, buildAiPlanPrompt, type PromptLocale } from './ai-prompt';
import {
  AI_REVIEW_HEADER_TEMPLATE,
  AI_REVIEW_NOTES_PLACEHOLDER,
  buildAiReviewPrompt,
  buildReviewSummary,
  formatReviewNumber,
  reviewSetText,
  type AiReviewInput,
} from './ai-review-prompt';

const ROOT = path.join(__dirname, '..', '..');
const SPEC = fs.readFileSync(path.join(ROOT, 'docs', 'SPEC-v3.md'), 'utf8');

function exercise(overrides: Partial<Exercise> & Pick<Exercise, 'id'>): Exercise {
  return {
    name: { en: 'Name', 'pt-BR': 'Nome' },
    aliases: [],
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    mechanics: 'compound',
    custom: false,
    archived: false,
    ...overrides,
  };
}

const BENCH = exercise({
  id: 'barbell-bench-press',
  name: { en: 'Barbell Bench Press', 'pt-BR': 'Supino reto com barra' },
  primaryMuscle: 'chest',
  equipment: 'barbell',
});

const HAMMER_ROW = exercise({
  id: 'custom-7',
  name: { en: 'Hammer row', 'pt-BR': 'Remada Hammer' },
  primaryMuscle: 'back',
  equipment: 'machine',
  custom: true,
});

const ARCHIVED = exercise({ id: 'custom-9', name: { en: 'Old', 'pt-BR': 'Antigo' }, custom: true, archived: true });

const PLAN_JSON = '{\n  "format": "cycle-plan",\n  "version": 1\n}';

/** The two-exercise fixture of SPEC-v3 §7, in plain data. */
function fixture(locale: PromptLocale, overrides: Partial<AiReviewInput> = {}): AiReviewInput {
  return {
    locale,
    planJson: PLAN_JSON,
    notes: undefined,
    period: { from: '2026-10-01', to: '2026-11-10' },
    sessions: { done: 10, planned: 14 },
    exercises: [
      {
        exerciseId: 'barbell-bench-press',
        name: locale === 'en' ? 'Barbell Bench Press' : 'Supino reto com barra',
        stalled: true,
        sessions: [
          {
            date: '2026-11-05',
            deload: false,
            sets: [
              { weightKg: 40, reps: 12, rir: 2 },
              { weightKg: 40, reps: 12, rir: 2 },
              { weightKg: 40, reps: 11, rir: 1 },
            ],
          },
          {
            date: '2026-10-29',
            deload: true,
            sets: [
              { weightKg: 35, reps: 8, rir: null },
              { weightKg: 35, reps: 8, rir: null },
              { weightKg: 28, reps: 10, rir: null, drop: true },
            ],
          },
        ],
      },
      {
        exerciseId: 'custom-7',
        name: locale === 'en' ? 'Hammer row' : 'Remada Hammer',
        stalled: false,
        sessions: [],
      },
    ],
    muscleSetsPerWeek: [
      { muscle: 'chest', sets: 12 },
      { muscle: 'back', sets: 10.5 },
    ],
    exerciseList: [BENCH, HAMMER_ROW],
    ...overrides,
  };
}

/** The two ````text blocks of SPEC-v3 §7, without the two-space list indentation. */
function specHeaderBlocks(): string[] {
  const start = SPEC.indexOf('## 7. Review with AI');
  const end = SPEC.indexOf('## 8. Backup');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const blocks: string[] = [];
  let current: string[] | null = null;
  for (const line of SPEC.slice(start, end).split('\n')) {
    if (current === null) {
      if (/^\s*````text\s*$/.test(line)) current = [];
    } else if (/^\s*````\s*$/.test(line)) {
      blocks.push(current.join('\n'));
      current = null;
    } else {
      current.push(line.replace(/^ {2}/, ''));
    }
  }
  return blocks;
}

describe('AI_REVIEW_HEADER_TEMPLATE', () => {
  it('equals the two header blocks of docs/SPEC-v3.md §7, en then pt-BR', () => {
    const blocks = specHeaderBlocks();
    expect(blocks).toHaveLength(2);
    expect(AI_REVIEW_HEADER_TEMPLATE.en).toBe(blocks[0]);
    expect(AI_REVIEW_HEADER_TEMPLATE['pt-BR']).toBe(blocks[1]);
  });

  it('has the three placeholders once in each locale', () => {
    for (const locale of ['en', 'pt-BR'] as const) {
      for (const key of ['{{NOTES}}', '{{PLAN}}', '{{SUMMARY}}']) {
        expect(AI_REVIEW_HEADER_TEMPLATE[locale].split(key)).toHaveLength(2);
      }
    }
  });
});

describe('AI_REVIEW_NOTES_PLACEHOLDER', () => {
  it('holds the placeholder sentence of each locale', () => {
    expect(AI_REVIEW_NOTES_PLACEHOLDER.en).toBe('(write here how you feel, pains, schedule changes)');
    expect(AI_REVIEW_NOTES_PLACEHOLDER['pt-BR']).toBe('(escreva aqui como você se sente, dores, mudanças de agenda)');
  });
});

describe('formatReviewNumber', () => {
  it.each([
    [40, '40'],
    [42.5, '42.5'],
    [10.5, '10.5'],
    [0.25, '0.25'],
    [1.999, '2'],
    [0, '0'],
  ])('formats %p as %p', (value, expected) => {
    expect(formatReviewNumber(value)).toBe(expected);
  });
});

describe('reviewSetText', () => {
  it('writes weight×reps@RIR', () => {
    expect(reviewSetText({ weightKg: 40, reps: 12, rir: 2 })).toBe('40×12@2');
  });

  it('omits the RIR when it is not logged', () => {
    expect(reviewSetText({ weightKg: 35, reps: 8, rir: null })).toBe('35×8');
  });

  it('keeps an RIR of 0', () => {
    expect(reviewSetText({ weightKg: 40, reps: 12, rir: 0 })).toBe('40×12@0');
  });

  it('prefixes a drop set with d', () => {
    expect(reviewSetText({ weightKg: 28, reps: 10, rir: null, drop: true })).toBe('d28×10');
    expect(reviewSetText({ weightKg: 28, reps: 10, rir: 1, drop: true })).toBe('d28×10@1');
  });

  it('uses a decimal point and no trailing zeros', () => {
    expect(reviewSetText({ weightKg: 10.5, reps: 10, rir: null })).toBe('10.5×10');
  });
});

describe('buildReviewSummary', () => {
  it('writes the English summary of the fixture', () => {
    const expected = [
      'Period: 2026-10-01 to 2026-11-10',
      'Sessions done: 10 of 14 planned (adherence 71%)',
      'Set notation: weight×reps@RIR in kg; d = drop set.',
      '',
      'barbell-bench-press — Barbell Bench Press [stalled]',
      '  2026-11-05: 40×12@2, 40×12@2, 40×11@1',
      '  2026-10-29 (deload): 35×8, 35×8, d28×10',
      '',
      'custom-7 — Hammer row',
      '  (no sessions)',
      '',
      'Weekly sets per muscle group (average): chest 12, back 10.5',
    ].join('\n');
    expect(buildReviewSummary(fixture('en'))).toBe(expected);
  });

  it('writes the pt-BR summary of the fixture', () => {
    const expected = [
      'Período: 2026-10-01 a 2026-11-10',
      'Sessões feitas: 10 de 14 planejadas (aderência 71%)',
      'Notação das séries: carga×repetições@RIR em kg; d = drop set.',
      '',
      'barbell-bench-press — Supino reto com barra [estagnado]',
      '  2026-11-05: 40×12@2, 40×12@2, 40×11@1',
      '  2026-10-29 (deload): 35×8, 35×8, d28×10',
      '',
      'custom-7 — Remada Hammer',
      '  (sem sessões)',
      '',
      'Séries semanais por grupo muscular (média): chest 12, back 10.5',
    ].join('\n');
    expect(buildReviewSummary(fixture('pt-BR'))).toBe(expected);
  });

  it('omits the period line when the period is null', () => {
    const summary = buildReviewSummary(fixture('en', { period: null }));
    expect(summary.startsWith('Sessions done: 10 of 14 planned (adherence 71%)\n')).toBe(true);
    expect(summary).not.toContain('Period:');
  });

  it('omits the sessions line when the sessions are null', () => {
    const summary = buildReviewSummary(fixture('pt-BR', { sessions: null }));
    expect(summary.startsWith('Período: 2026-10-01 a 2026-11-10\nNotação das séries:')).toBe(true);
    expect(summary).not.toContain('Sessões feitas');
  });

  it('omits the sessions line when nothing was planned', () => {
    const summary = buildReviewSummary(fixture('en', { sessions: { done: 2, planned: 0 } }));
    expect(summary).not.toContain('Sessions done');
  });

  it.each([
    [10, 14, '71%'],
    [1, 3, '33%'],
    [3, 3, '100%'],
    [0, 5, '0%'],
  ])('rounds the adherence of %p of %p to %p', (done, planned, percent) => {
    const summary = buildReviewSummary(fixture('en', { sessions: { done, planned } }));
    expect(summary).toContain(`(adherence ${percent})`);
  });

  it('prints only the 6 newest sessions of an exercise', () => {
    const sessions = [7, 6, 5, 4, 3, 2, 1].map((day) => ({
      date: `2026-11-0${day}`,
      deload: false,
      sets: [{ weightKg: 20, reps: 10, rir: null }],
    }));
    const summary = buildReviewSummary(
      fixture('en', {
        exercises: [{ exerciseId: 'custom-7', name: 'Hammer row', stalled: false, sessions }],
      }),
    );
    expect(summary).toContain('  2026-11-07: 20×10');
    expect(summary).toContain('  2026-11-02: 20×10');
    expect(summary).not.toContain('2026-11-01');
  });

  it('omits the muscle line when there are no weekly sets', () => {
    const summary = buildReviewSummary(fixture('en', { muscleSetsPerWeek: [] }));
    expect(summary).not.toContain('Weekly sets per muscle group');
    expect(summary.endsWith('  (no sessions)')).toBe(true);
  });
});

describe('buildAiReviewPrompt', () => {
  it('puts the trimmed notes into MY NOTES', () => {
    const prompt = buildAiReviewPrompt(fixture('en', { notes: '  Left elbow hurts.\n' }));
    expect(prompt).toContain('MY NOTES\nLeft elbow hurts.\n\nCURRENT PLAN');
    expect(prompt).not.toContain('(write here how you feel');
  });

  it('uses the localized placeholder sentence when the notes are empty or blank', () => {
    expect(buildAiReviewPrompt(fixture('en', { notes: '' }))).toContain(`MY NOTES\n${AI_REVIEW_NOTES_PLACEHOLDER.en}\n`);
    expect(buildAiReviewPrompt(fixture('pt-BR', { notes: '   ' }))).toContain(
      `MINHAS OBSERVAÇÕES\n${AI_REVIEW_NOTES_PLACEHOLDER['pt-BR']}\n`,
    );
  });

  it('contains the plan JSON verbatim and the summary', () => {
    const prompt = buildAiReviewPrompt(fixture('en'));
    expect(prompt).toContain(`CURRENT PLAN (cycle-plan JSON)\n${PLAN_JSON}\n\nTRAINING SUMMARY\n`);
    expect(prompt).toContain(buildReviewSummary(fixture('en')));
    expect(prompt).not.toContain('{{');
  });

  it('does not expand placeholders written inside the plan JSON', () => {
    const prompt = buildAiReviewPrompt(fixture('en', { planJson: '{"name": "{{SUMMARY}}"}' }));
    expect(prompt).toContain('{"name": "{{SUMMARY}}"}');
  });

  it('starts with the header of its locale', () => {
    expect(buildAiReviewPrompt(fixture('en')).startsWith('You are an experienced strength and hypertrophy coach.')).toBe(true);
    expect(buildAiReviewPrompt(fixture('pt-BR')).startsWith('Você é um treinador experiente')).toBe(true);
  });

  it.each(['en', 'pt-BR'] as const)('ends with the plan prompt OUTPUT section (%s)', (locale) => {
    const input = fixture(locale);
    const prompt = buildAiReviewPrompt(input);
    const section = aiPlanPromptOutputSection(input.exerciseList, locale);
    expect(prompt.endsWith(`\n\n${section}`)).toBe(true);
  });
});

describe('aiPlanPromptOutputSection', () => {
  it('starts at the OUTPUT line in en and at the SAÍDA line in pt-BR', () => {
    expect(aiPlanPromptOutputSection([BENCH], 'en').startsWith('OUTPUT\nReply with ONE JSON document')).toBe(true);
    expect(aiPlanPromptOutputSection([BENCH], 'pt-BR').startsWith('SAÍDA\nResponda com UM documento JSON')).toBe(true);
  });

  it.each(['en', 'pt-BR'] as const)('is the end of buildAiPlanPrompt (%s), unchanged', (locale) => {
    const exercises = [BENCH, HAMMER_ROW, ARCHIVED];
    const full = buildAiPlanPrompt(exercises, locale);
    const section = aiPlanPromptOutputSection(exercises, locale);
    expect(full.endsWith(section)).toBe(true);
    expect(full.slice(0, full.length - section.length)).toMatch(/\n$/);
  });

  it('fills the exercise list with the non-archived exercises in order', () => {
    const section = aiPlanPromptOutputSection([BENCH, ARCHIVED, HAMMER_ROW], 'pt-BR');
    expect(section.endsWith(
      'barbell-bench-press — Supino reto com barra — chest — barbell\ncustom-7 — Remada Hammer — back — machine',
    )).toBe(true);
    expect(section).not.toContain('{{EXERCISES}}');
    expect(section).not.toContain('custom-9');
  });
});

describe('the first 30 lines of a full prompt', () => {
  it('match the English fixture', () => {
    const lines = buildAiReviewPrompt(fixture('en', { notes: 'Feeling fine.' })).split('\n').slice(0, 30);
    expect(lines).toEqual([
      'You are an experienced strength and hypertrophy coach. Below are my current training plan in the',
      'CYCLE app and a summary of what I actually did. Review my results and give me an adjusted plan as a',
      'file for the CYCLE app.',
      '',
      'HOW TO REVIEW',
      'Look at each exercise: where the load or the reps went up, keep what works; where I stalled or fell',
      'below the rep range, change something (rep range, sets, exercise variation, order or rest). Check',
      'the weekly sets per muscle group and my adherence, and rebalance the volume if needed. Keep the',
      'exercises I am progressing on unless there is a reason to swap them. After the JSON, explain the',
      'main changes in a few lines. If my notes are empty and you need to know how I feel (pain, fatigue,',
      'schedule changes), ask me first and wait for my answer.',
      '',
      'MY NOTES',
      'Feeling fine.',
      '',
      'CURRENT PLAN (cycle-plan JSON)',
      '{',
      '  "format": "cycle-plan",',
      '  "version": 1',
      '}',
      '',
      'TRAINING SUMMARY',
      'Period: 2026-10-01 to 2026-11-10',
      'Sessions done: 10 of 14 planned (adherence 71%)',
      'Set notation: weight×reps@RIR in kg; d = drop set.',
      '',
      'barbell-bench-press — Barbell Bench Press [stalled]',
      '  2026-11-05: 40×12@2, 40×12@2, 40×11@1',
      '  2026-10-29 (deload): 35×8, 35×8, d28×10',
      '',
    ]);
  });
});
