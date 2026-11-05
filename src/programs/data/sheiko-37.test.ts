import { dayNotation } from '@/test-utils/program-notation';

import { BLOCK_WEEKS, getBlock, maxBlockStartWeek } from '../blocks';
import { sheiko37 } from './sheiko-37';

/**
 * Data test of Sheiko #37 (docs/DECISIONS.md, Stage 9), day by day. The data file is transcribed
 * from the adopted source (Lift Vault, “Sheiko Program Spreadsheets”, tab “#37”); the main-lift sets
 * below were taken from the second transcription, Lift Vault, “Sheiko 3 Day Under 80 kg” workbook, tab “#37”,
 * and agree with it set by set. Exercise and accessory names follow the adopted spreadsheet.
 * Notation (src/test-utils/program-notation.ts): sets x reps @ % of the competition 1RM.
 */
const EXPECTED: Record<string, string[]> = {
  w1d1: [
    'bench: 1x5@50 2x4@60 2x3@70 5x3@75',
    'squat: 1x5@50 2x5@60 5x5@70',
    'acc Dumbbell fly: 5 sets × 10 reps',
    'bench: 1x6@50 2x6@60 4x6@65',
    'acc Good morning (standing): 5 sets × 5 reps',
  ],
  w1d2: [
    'deadlift: 1x5@50 2x5@60 2x4@70 4x3@75',
    'acc Incline bench press: 6 sets × 4 reps',
    'acc Dip: 5 sets × 5 reps',
    'deadlift (Deadlift from boxes): 1x5@50 2x5@60 2x4@70 4x3@80',
    'acc Lunge: 5 sets × 5 reps',
    'acc Abs: 3 sets × 10 reps',
  ],
  w1d3: [
    'bench: 1x7@50 1x6@55 1x5@60 1x4@65 2x3@70 2x2@75 2x3@70 1x4@65 1x6@60 1x8@55 1x10@50',
    'acc Dumbbell fly: 5 sets × 10 reps',
    'squat: 1x5@50 2x4@60 2x3@70 5x3@75',
    'acc French press: 5 sets × 10 reps',
    'acc Good morning (sitting): 5 sets × 5 reps',
  ],
  w2d1: [
    'squat: 1x5@50 2x4@60 2x3@70 5x2@80',
    'bench: 1x5@50 1x4@60 2x3@70 6x2@80',
    'acc Dumbbell fly: 5 sets × 10 reps',
    'acc Push up: 5 sets × 10 reps',
    'squat: 1x3@55 1x3@65 4x3@75',
    'acc Good morning (standing): 5 sets × 5 reps',
  ],
  w2d2: [
    'deadlift (Deadlift up to knees): 1x4@50 2x4@60 4x4@70',
    'bench: 1x5@50 2x5@60 5x4@70',
    'acc Dumbbell fly: 5 sets × 10 reps',
    'deadlift: 1x4@50 1x4@60 2x3@70 5x3@75',
    'acc Lunge: 5 sets × 5 reps',
  ],
  w2d3: [
    'squat: 1x4@50 1x4@60 2x3@70 6x3@75',
    'bench: 1x6@50 1x5@60 2x4@70 2x3@75 2x2@80 1x4@75 1x5@70 1x6@60 1x7@50',
    'acc Dumbbell fly: 5 sets × 10 reps',
    'acc Triceps: 5 sets × 10 reps',
    'squat: 1x3@55 1x3@65 4x2@75',
    'acc Good morning (sitting): 5 sets × 6 reps',
  ],
  w3d1: [
    'squat: 1x5@50 2x4@60 2x3@70 5x3@80',
    'bench: 1x5@50 1x4@60 2x3@70 5x3@80',
    'acc Dumbbell fly: 5 sets × 10 reps',
    'acc Push up: 5 sets × 10 reps',
    'squat: 1x5@50 1x5@60 5x5@70',
    'acc Abs: 3 sets × 10 reps',
  ],
  w3d2: [
    'deadlift (Deadlift up to knees): 1x4@50 1x4@60 2x4@70 4x4@75',
    'bench: 1x6@50 1x5@60 2x4@70 2x3@75 2x2@80 2x3@75 1x4@70 1x5@65 1x6@60 1x7@55 1x8@50',
    'acc Dumbbell fly: 5 sets × 10 reps',
    'deadlift (Deadlift from boxes): 1x5@60 2x5@70 4x4@80',
    'acc Lunge: 5 sets × 5 reps',
    'acc Abs: 3 sets × 10 reps',
  ],
  w3d3: [
    'bench: 1x5@50 1x4@60 2x3@70 5x2@80',
    'squat: 1x5@50 1x5@60 2x5@70 5x4@75',
    'bench: 1x6@50 2x6@60 4x6@65',
    'acc Dumbbell fly: 5 sets × 10 reps',
    'acc Good morning (standing): 5 sets × 5 reps',
  ],
  w4d1: [
    'squat: 1x5@50 1x4@60 2x3@70 2x3@80 3x2@85',
    'bench: 1x5@50 1x4@60 2x3@70 5x3@80',
    'acc Dumbbell fly: 5 sets × 10 reps',
    'acc Dip: 5 sets × 8 reps',
    'squat: 1x5@50 1x4@60 2x3@70 4x2@80',
    'acc Good morning (standing): 5 sets × 5 reps',
  ],
  w4d2: [
    'bench: 1x5@50 1x4@60 2x3@70 2x3@80 3x2@85',
    'deadlift: 1x4@50 1x4@60 2x3@70 2x3@80 3x2@85',
    'bench: 1x5@55 1x5@65 4x4@75',
    'acc Dumbbell fly: 5 sets × 10 reps',
    'acc Lunge: 5 sets × 5 reps',
  ],
  w4d3: [
    'squat: 1x5@50 1x4@60 2x3@70 6x3@80',
    'bench: 1x5@50 1x5@60 5x5@70',
    'acc Dumbbell fly: 5 sets × 10 reps',
    'acc Dip: 5 sets × 8 reps',
    'acc Good morning (sitting): 5 sets × 5 reps',
    'acc Abs: 3 sets × 10 reps',
  ],
};

describe('sheiko-37 template', () => {
  it('is Sheiko #37: 4 weeks, 3 days a week, any of the three lifts', () => {
    expect(sheiko37).toMatchObject({
      id: 'sheiko-37',
      family: 'sheiko',
      name: 'Sheiko #37',
      variant: '#37',
      durationWeeks: 4,
      daysPerWeek: 3,
      allowedLifts: ['bench', 'squat', 'deadlift'],
      liftSelectable: true,
      verification: 'partial',
    });
    expect(sheiko37.weeks.map((w) => w.week)).toEqual([1, 2, 3, 4]);
    for (const week of sheiko37.weeks) expect(week.days.map((d) => d.day)).toEqual([1, 2, 3]);
  });

  it('labels the days Monday / Wednesday / Friday, as the source does', () => {
    for (const week of [1, 2, 3, 4]) {
      expect(sheiko37.weeks[week - 1].days.map((d) => d.label?.en)).toEqual(['Monday', 'Wednesday', 'Friday']);
      expect(sheiko37.weeks[week - 1].days.map((d) => d.label?.['pt-BR'])).toEqual(['Segunda-feira', 'Quarta-feira', 'Sexta-feira']);
    }
  });

  it('cites the adopted spreadsheet, its cross-check, the URL and the access date', () => {
    expect(sheiko37.source.url).toBe('https://docs.google.com/spreadsheets/d/1vBdL47glReiNALmFw1_ieRg6nMYaJ5OFlmidJ9nUNNM/edit');
    expect(sheiko37.source.accessedAt).toBe('2026-11-05');
    expect(sheiko37.source.author).toMatch(/Sheiko/);
    expect(sheiko37.source.reference).toMatch(/Lift Vault.*#37/);
    expect(sheiko37.source.notes).toMatch(/liftvault\.com\/programs\/powerlifting\/sheiko-spreadsheets/);
    expect(sheiko37.source.notes).toMatch(/docs\.google\.com\/spreadsheets\/d\/12VzUk4JAWHulBnYfJIo4-JUAEe9yBxD6F5hy1jw9eKk/);
  });

  it('lists every day of the month in the expected table', () => {
    expect(Object.keys(EXPECTED)).toHaveLength(12);
  });

  it.each(Object.keys(EXPECTED))('%s matches the source table', (key) => {
    const [, week, day] = /^w(\d)d(\d)$/.exec(key)!.map(Number);
    expect(dayNotation(sheiko37, week, day)).toEqual(EXPECTED[key]);
  });

  it('is browsed in blocks: start weeks 1–2 give three weeks, 3–4 a partial block', () => {
    expect(maxBlockStartWeek(sheiko37)).toBe(2);
    expect(getBlock(sheiko37, 1).weeks.map((w) => w.week.week)).toEqual([1, 2, 3]);
    expect(getBlock(sheiko37, 2).weeks.map((w) => w.week.week)).toEqual([2, 3, 4]);
    expect(getBlock(sheiko37, 3).weeks.map((w) => w.week.week)).toEqual([3, 4]);
    expect(getBlock(sheiko37, 4).weeks.map((w) => w.week.week)).toEqual([4]);
    expect(getBlock(sheiko37, 1).weeks).toHaveLength(BLOCK_WEEKS);
  });
});
