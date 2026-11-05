import { dayNotation } from '@/test-utils/program-notation';

import { BLOCK_WEEKS, getBlock, maxBlockStartWeek } from '../blocks';
import { sheiko32 } from './sheiko-32';

/**
 * Data test of Sheiko #32 (docs/DECISIONS.md, Stage 9), day by day. The data file is transcribed
 * from the adopted source (Lift Vault, “Sheiko Program Spreadsheets”, tab “#32”); the main-lift sets
 * below were taken from the second transcription, Lift Vault, “Sheiko 3 Day Under 80 kg” workbook, tab “#32”,
 * and agree with it set by set. Exercise and accessory names follow the adopted spreadsheet.
 * Notation (src/test-utils/program-notation.ts): sets x reps @ % of the competition 1RM.
 */
const EXPECTED: Record<string, string[]> = {
  w1d1: [
    'squat: 1x3@50 1x3@60 2x3@70 3x2@75',
    'bench: 1x3@50 1x3@60 2x3@70 3x2@75',
    'acc Abs: 3 sets × 10 reps',
  ],
  w1d2: [
    'squat: 1x3@50 2x3@60 2x2@70 1x2@80 1x1@90',
    'info squat unverified: Max attempts: 2–3 singles at 100–105% of 1RM.',
    'bench: 1x3@50 1x3@60 2x2@70 1x2@80 1x1@90',
    'info bench unverified: Max attempts: 2–3 singles at 100–105% of 1RM.',
    'deadlift: 1x3@50 1x2@60 2x2@70 1x1@80 1x1@90',
    'info deadlift unverified: Max attempts: 2–3 singles at 100–105% of 1RM.',
  ],
  w1d3: [
    'squat: 1x3@50 2x3@60 2x3@70 4x2@75',
    'bench: 1x3@55 2x3@65 6x3@75',
    'acc Dumbbell fly: 5 sets × 10 reps',
    'acc Good morning (standing): 5 sets × 5 reps',
    'acc Abs: 3 sets × 10 reps',
  ],
  w2d1: [
    'squat: 1x3@50 2x3@60 2x3@70 4x2@80',
    'bench: 1x3@50 1x3@60 2x3@70 5x3@80',
    'acc Dumbbell fly: 4 sets × 8 reps',
    'squat: 1x3@55 2x3@65 4x3@75',
  ],
  w2d2: [
    'deadlift (Deadlift up to knees): 1x3@50 2x2@60 2x2@65 3x1@70',
    'bench: 1x3@50 1x3@60 2x3@70 2x3@80 3x2@85',
    'acc Dumbbell fly: 5 sets × 10 reps',
    'deadlift: 1x3@50 1x3@60 2x3@70 5x3@80',
    'acc Abs: 3 sets × 10 reps',
  ],
  w2d3: [
    'bench: 1x3@50 1x3@60 2x3@70 5x3@80',
    'squat: 1x3@50 2x3@60 2x3@70 6x3@80',
    'bench: 1x4@50 1x4@60 4x4@70',
    'acc Dumbbell fly: 5 sets × 10 reps',
    'acc Good morning (standing): 5 sets × 5 reps',
  ],
  w3d1: [
    'squat: 1x3@50 1x3@60 2x3@70 5x2@80',
    'bench: 1x3@50 1x3@60 2x3@70 3x2@80 3x1@85',
    'acc Dumbbell fly: 4 sets × 8 reps',
    'acc Abs: 5 sets × 4 reps',
  ],
  w3d2: [
    'bench: 1x3@50 1x3@60 2x3@70 5x2@80',
    'acc Dumbbell fly: 4 sets × 8 reps',
    'deadlift: 1x3@50 2x3@60 2x3@70 5x2@75',
    'acc Good morning (standing): 4 sets × 5 reps',
  ],
  w3d3: [
    'squat: 1x3@50 2x3@60 2x2@70 3x2@75',
    'bench: 1x3@50 1x3@60 2x3@70 4x2@75',
    'acc Abs: 3 sets × 8 reps',
  ],
  w4d1: [
    'bench: 1x3@50 2x3@60 2x2@70 4x1@75',
    'deadlift: 1x3@50 2x2@60 4x2@70',
    'acc Abs: 2 sets × 8 reps',
  ],
  w4d2: [
    'squat: 1x3@50 2x3@60 3x2@70',
    'bench: 1x3@50 2x3@60 3x2@70',
  ],
  w4d3: [
    'info: Competition (or max test): no sets prescribed.',
  ],
};

describe('sheiko-32 template', () => {
  it('is Sheiko #32: 4 weeks, 3 days a week, any of the three lifts', () => {
    expect(sheiko32).toMatchObject({
      id: 'sheiko-32',
      family: 'sheiko',
      name: 'Sheiko #32',
      variant: '#32',
      durationWeeks: 4,
      daysPerWeek: 3,
      allowedLifts: ['bench', 'squat', 'deadlift'],
      liftSelectable: true,
      verification: 'partial',
    });
    expect(sheiko32.weeks.map((w) => w.week)).toEqual([1, 2, 3, 4]);
    for (const week of sheiko32.weeks) expect(week.days.map((d) => d.day)).toEqual([1, 2, 3]);
  });

  it('labels the days Monday / Wednesday / Friday, as the source does', () => {
    for (const week of [1, 2, 3]) {
      expect(sheiko32.weeks[week - 1].days.map((d) => d.label?.en)).toEqual(['Monday', 'Wednesday', 'Friday']);
      expect(sheiko32.weeks[week - 1].days.map((d) => d.label?.['pt-BR'])).toEqual(['Segunda-feira', 'Quarta-feira', 'Sexta-feira']);
    }
  });

  it('labels week 4 day 3 with the source\'s "5-6-7 day" (the competition)', () => {
    expect(sheiko32.weeks[3].days.map((d) => d.label?.en)).toEqual(['Monday', 'Wednesday', 'Days 5–7']);
    expect(sheiko32.weeks[3].days[2].label?.['pt-BR']).toBe('Dias 5–7');
  });

  it('cites the adopted spreadsheet, its cross-check, the URL and the access date', () => {
    expect(sheiko32.source.url).toBe('https://docs.google.com/spreadsheets/d/1vBdL47glReiNALmFw1_ieRg6nMYaJ5OFlmidJ9nUNNM/edit');
    expect(sheiko32.source.accessedAt).toBe('2026-11-05');
    expect(sheiko32.source.author).toMatch(/Sheiko/);
    expect(sheiko32.source.reference).toMatch(/Lift Vault.*#32/);
    expect(sheiko32.source.notes).toMatch(/liftvault\.com\/programs\/powerlifting\/sheiko-spreadsheets/);
    expect(sheiko32.source.notes).toMatch(/docs\.google\.com\/spreadsheets\/d\/12VzUk4JAWHulBnYfJIo4-JUAEe9yBxD6F5hy1jw9eKk/);
  });

  it('lists every day of the month in the expected table', () => {
    expect(Object.keys(EXPECTED)).toHaveLength(12);
  });

  it.each(Object.keys(EXPECTED))('%s matches the source table', (key) => {
    const [, week, day] = /^w(\d)d(\d)$/.exec(key)!.map(Number);
    expect(dayNotation(sheiko32, week, day)).toEqual(EXPECTED[key]);
  });

  it('is browsed in blocks: start weeks 1–2 give three weeks, 3–4 a partial block', () => {
    expect(maxBlockStartWeek(sheiko32)).toBe(2);
    expect(getBlock(sheiko32, 1).weeks.map((w) => w.week.week)).toEqual([1, 2, 3]);
    expect(getBlock(sheiko32, 2).weeks.map((w) => w.week.week)).toEqual([2, 3, 4]);
    expect(getBlock(sheiko32, 3).weeks.map((w) => w.week.week)).toEqual([3, 4]);
    expect(getBlock(sheiko32, 4).weeks.map((w) => w.week.week)).toEqual([4]);
    expect(getBlock(sheiko32, 1).weeks).toHaveLength(BLOCK_WEEKS);
  });
});
