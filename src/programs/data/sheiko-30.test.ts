import { dayNotation } from '@/test-utils/program-notation';

import { BLOCK_WEEKS, getBlock, maxBlockStartWeek } from '../blocks';
import { sheiko30 } from './sheiko-30';

/**
 * Data test of Sheiko #30 (docs/DECISIONS.md, Stage 9), day by day. The data file is transcribed
 * from the adopted source (Lift Vault, “Sheiko Program Spreadsheets”, tab “#30”); the main-lift sets
 * below were taken from the second transcription, Liftosaur, “Sheiko #29-32”, weeks 5–8 (https://www.liftosaur.com/programs/sheiko-29-32),
 * and agree with it set by set. Exercise and accessory names follow the adopted spreadsheet.
 * Notation (src/test-utils/program-notation.ts): sets x reps @ % of the competition 1RM.
 */
const EXPECTED: Record<string, string[]> = {
  w1d1: [
    'bench: 1x5@50 2x4@60 2x3@70 5x3@80',
    'squat: 1x5@50 1x4@60 2x3@70 5x3@80',
    'bench: 1x5@50 1x5@60 5x5@70',
    'acc Dumbbell fly: 5 sets × 10 reps',
    'squat: 1x5@55 1x4@65 5x3@75',
    'acc Good morning (standing): 5 sets × 5 reps',
  ],
  w1d2: [
    'deadlift: 1x4@50 2x4@60 2x3@70 5x3@80',
    'bench: 1x5@50 1x5@60 2x4@70 2x3@75 2x2@80 2x1@85 2x2@80 2x3@75 1x4@70 1x6@65 1x8@60 1x10@55 1x12@50',
    'acc Dumbbell fly: 6 sets × 4 reps',
    'deadlift (Deadlift from boxes): 1x5@60 2x4@70 3x3@80 4x2@90',
    'acc Lunge: 5 sets × 5 reps',
    'acc Abs: 3 sets × 10 reps',
  ],
  w1d3: [
    'squat: 1x5@50 2x4@60 2x3@70 5x3@80',
    'bench: 1x5@50 2x4@60 2x3@70 6x2@80',
    'acc Dip: 5 sets × 6 reps',
    'squat: 1x5@50 2x5@60 4x4@70',
    'acc French press: 5 sets × 10 reps',
    'acc Good morning (sitting): 5 sets × 5 reps',
  ],
  w2d1: [
    'squat: 1x5@50 2x4@60 2x3@70 2x2@80 3x1@90',
    'bench: 1x5@50 1x4@60 2x3@70 6x2@80',
    'acc Dumbbell fly: 5 sets × 10 reps',
    'acc Push up: 5 sets × 10 reps',
    'squat: 1x5@50 1x4@60 2x3@70 4x2@80',
    'acc Good morning (standing): 5 sets × 5 reps',
  ],
  w2d2: [
    'deadlift (Deadlift up to knees): 1x4@50 2x4@60 2x3@70 4x3@75',
    'bench: 1x5@50 1x5@60 2x4@70 2x3@75 2x2@80 2x3@75 2x5@70 1x7@60 1x9@50',
    'acc Dumbbell fly: 5 sets × 10 reps',
    'deadlift: 1x4@50 1x4@60 2x3@70 5x3@80',
    'acc Lunge: 5 sets × 5 reps',
  ],
  w2d3: [
    'bench: 1x5@50 2x4@60 2x3@70 5x2@80',
    'squat: 1x5@50 2x5@60 5x5@70',
    'bench: 1x4@55 1x3@65 5x2@75',
    'acc Dip: 5 sets × 8 reps',
    'acc Leg press: 5 sets × 6 reps',
    'acc Good morning (sitting): 5 sets × 6 reps',
  ],
  w3d1: [
    'squat: 1x5@50 2x4@60 2x3@70 5x3@80',
    'bench: 1x5@50 1x4@60 2x3@70 5x3@80',
    'squat: 1x6@50 1x6@60 4x6@65',
    'bench: 1x5@55 2x5@65 4x4@75',
    'acc Dumbbell fly: 5 sets × 10 reps',
    'acc Good morning (standing): 5 sets × 5 reps',
  ],
  w3d2: [
    'deadlift: 1x4@50 1x4@60 2x3@70 3x3@80 3x2@85',
    'bench: 1x6@50 1x5@60 2x4@70 2x3@75 2x2@80 2x1@85 2x2@80 2x3@75 1x5@70 1x7@65 1x9@60 1x11@55 1x13@50',
    'acc Dumbbell fly: 5 sets × 10 reps',
    'deadlift (Deadlift from boxes): 1x5@65 2x5@75 4x4@85',
    'acc Lunge: 5 sets × 5 reps',
    'acc Abs: 3 sets × 10 reps',
  ],
  w3d3: [
    'bench: 1x5@50 1x4@60 2x3@70 6x3@80',
    'squat: 1x5@50 1x4@60 2x3@70 2x3@80 3x2@85 3x3@80',
    'bench: 1x5@50 2x5@60 5x5@70',
    'acc Dumbbell fly: 5 sets × 10 reps',
    'acc Good morning (sitting): 5 sets × 5 reps',
  ],
  w4d1: [
    'squat: 1x5@50 1x4@60 2x3@70 2x3@80 2x2@85 2x1@90',
    'bench: 1x5@50 1x4@60 2x3@70 2x3@80 2x2@85 2x3@80',
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

describe('sheiko-30 template', () => {
  it('is Sheiko #30: 4 weeks, 3 days a week, any of the three lifts', () => {
    expect(sheiko30).toMatchObject({
      id: 'sheiko-30',
      family: 'sheiko',
      name: 'Sheiko #30',
      variant: '#30',
      durationWeeks: 4,
      daysPerWeek: 3,
      allowedLifts: ['bench', 'squat', 'deadlift'],
      liftSelectable: true,
      verification: 'partial',
    });
    expect(sheiko30.weeks.map((w) => w.week)).toEqual([1, 2, 3, 4]);
    for (const week of sheiko30.weeks) expect(week.days.map((d) => d.day)).toEqual([1, 2, 3]);
  });

  it('labels the days Monday / Wednesday / Friday, as the source does', () => {
    for (const week of [1, 2, 3, 4]) {
      expect(sheiko30.weeks[week - 1].days.map((d) => d.label?.en)).toEqual(['Monday', 'Wednesday', 'Friday']);
      expect(sheiko30.weeks[week - 1].days.map((d) => d.label?.['pt-BR'])).toEqual(['Segunda-feira', 'Quarta-feira', 'Sexta-feira']);
    }
  });

  it('cites the adopted spreadsheet, its cross-check, the URL and the access date', () => {
    expect(sheiko30.source.url).toBe('https://docs.google.com/spreadsheets/d/1vBdL47glReiNALmFw1_ieRg6nMYaJ5OFlmidJ9nUNNM/edit');
    expect(sheiko30.source.accessedAt).toBe('2026-11-05');
    expect(sheiko30.source.author).toMatch(/Sheiko/);
    expect(sheiko30.source.reference).toMatch(/Lift Vault.*#30/);
    expect(sheiko30.source.notes).toMatch(/liftvault\.com\/programs\/powerlifting\/sheiko-spreadsheets/);
    expect(sheiko30.source.notes).toMatch(/liftosaur\.com\/programs\/sheiko-29-32/);
  });

  it('lists every day of the month in the expected table', () => {
    expect(Object.keys(EXPECTED)).toHaveLength(12);
  });

  it.each(Object.keys(EXPECTED))('%s matches the source table', (key) => {
    const [, week, day] = /^w(\d)d(\d)$/.exec(key)!.map(Number);
    expect(dayNotation(sheiko30, week, day)).toEqual(EXPECTED[key]);
  });

  it('is browsed in blocks: start weeks 1–2 give three weeks, 3–4 a partial block', () => {
    expect(maxBlockStartWeek(sheiko30)).toBe(2);
    expect(getBlock(sheiko30, 1).weeks.map((w) => w.week.week)).toEqual([1, 2, 3]);
    expect(getBlock(sheiko30, 2).weeks.map((w) => w.week.week)).toEqual([2, 3, 4]);
    expect(getBlock(sheiko30, 3).weeks.map((w) => w.week.week)).toEqual([3, 4]);
    expect(getBlock(sheiko30, 4).weeks.map((w) => w.week.week)).toEqual([4]);
    expect(getBlock(sheiko30, 1).weeks).toHaveLength(BLOCK_WEEKS);
  });
});
