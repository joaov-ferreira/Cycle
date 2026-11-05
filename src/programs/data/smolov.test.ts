import { generatePeriodization, type GeneratedSession, type RoundingConfig } from '@/domain/periodization';

import { BLOCK_WEEKS, getBlock, maxBlockStartWeek } from '../blocks';
import type { InfoItem, MainItem, PrescriptionItem, SetPrescription } from '../schema';
import { validateTemplate } from '../validate';
import { smolov } from './smolov';

/**
 * Data test against the adopted source (docs/DECISIONS.md, Stage 8): smolovjr.com, "Smolov Squat
 * Routine", cross-checked with Hunt Fitness (K. Hunt, 2024), My Training Guide (2015), Gigas
 * Nutrition, Liftosaur, J. Tadlock (2011, intro + base) and Lift Vault (all accessed 2026-11-05).
 * Notation below: sets × reps @ % of 1RM.
 *
 * | Week | Phase       | Day 1                         | Day 2                           | Day 3                       | Day 4        |
 * |------|-------------|-------------------------------|---------------------------------|-----------------------------|--------------|
 * | 1    | Intro       | 3×8@65 1×5@70 2×2@75 1×1@80   | = day 1                         | 4×5@70 1×3@75 2×2@80 1×1@90 | rest         |
 * | 2    | Intro       | 1×5@80                        | 1×5@82.5                        | 1×5@85                      | rest         |
 * | 3    | Base        | 4×9@70 (Mon)                  | 5×7@75 (Wed)                    | 7×5@80 (Fri)                | 10×3@85 (Sat)|
 * | 4    | Base        | week 3 + 10 kg                | + 10 kg                         | + 10 kg                     | + 10 kg      |
 * | 5    | Base        | week 3 + 15 kg                | + 15 kg                         | + 15 kg                     | + 15 kg      |
 * | 6    | Base        | rest                          | rest                            | 1RM test                    | 1RM test     |
 * | 7–8  | Switching   | unverified (no confirmed prescription, frequency included)                                    |
 * | 9    | Intense     | 1×3@65 1×4@75 3×4@85 1×5@?    | 1×3@60 1×3@70 1×4@80 1×3@90 2×5@85 | 1×4@65 1×4@70 5×4@80     | rest         |
 * | 10   | Intense     | 1×4@60 1×4@70 1×4@80 1×3@90 2×4@90 | 1×3@65 1×3@75 1×3@85 3×3@90 1×3@95 | 1×3@65 1×3@75 1×4@85 4×5@90 | rest |
 * | 11   | Intense     | 1×3@60 1×3@70 1×3@80 5×5@90   | 1×3@60 1×3@70 1×3@80 2×3@95     | 1×3@65 1×3@75 1×3@85 4×3@95 | rest         |
 * | 12   | Intense     | 1×3@70 1×4@80 5×5@90          | 1×3@70 1×3@80 4×3@95            | 1×3@75 1×4@90 3×4@?         | rest         |
 * | 13   | Taper/test  | 1×3@70 1×3@80 2×5@90 3×4@95   | 1×4@75 4×4@85                   | 1RM test                    | rest         |
 *
 * `?` = the sources disagree (week 9 day 1: 85% or 90%; week 12 day 3: 95% or 80%), so the set is
 * unverified and has no load.
 */

const s = (repeat: number, reps: number, percent: number): SetPrescription =>
  repeat === 1 ? { reps, percent } : { repeat, reps, percent };

function item(week: number, day: number): PrescriptionItem {
  const items = smolov.weeks[week - 1].days[day - 1].items;
  expect(items).toHaveLength(1);
  return items[0];
}

function sets(week: number, day: number): SetPrescription[] {
  const main = item(week, day) as MainItem;
  expect(main).toMatchObject({ kind: 'main', lift: 'squat' });
  return main.sets;
}

function info(week: number, day: number): InfoItem {
  const line = item(week, day) as InfoItem;
  expect(line.kind).toBe('info');
  return line;
}

const isRest = (week: number, day: number) => expect(info(week, day).text.en).toMatch(/^Rest day/);
const isTest = (week: number, day: number) => expect(info(week, day).text.en).toMatch(/^1RM test/);

describe('smolov template', () => {
  it('has the Smolov identity: 13 weeks, up to 4 days per week, squat only', () => {
    expect(smolov).toMatchObject({
      id: 'smolov',
      family: 'smolov',
      name: 'Smolov',
      durationWeeks: 13,
      daysPerWeek: 4,
      allowedLifts: ['squat'],
      liftSelectable: false,
      verification: 'partial',
    });
  });

  it('stores all 13 weeks in order, each with its 4 days (nothing compressed)', () => {
    expect(smolov.weeks).toHaveLength(13);
    expect(smolov.weeks.map((w) => w.week)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    for (const week of smolov.weeks) expect(week.days.map((d) => d.day)).toEqual([1, 2, 3, 4]);
    // every main item is the squat (lift fixed)
    for (const week of smolov.weeks)
      for (const day of week.days)
        for (const it of day.items) if (it.kind === 'main') expect(it.lift).toBe('squat');
  });

  it('cites the adopted source and the cross-checks with URL and access date', () => {
    expect(smolov.source.url).toBe('https://www.smolovjr.com/smolov-squat-routine');
    expect(smolov.source.accessedAt).toBe('2026-11-05');
    expect(smolov.source.author).toMatch(/Smolov/);
    expect(smolov.source.reference).toMatch(/smolovjr\.com/);
    for (const site of [/kylehuntfitness\.com/, /mytrainingguide\.blogspot\.com/, /gigasnutrition\.com/, /liftosaur\.com/, /justintadlock\.com/, /liftvault\.com/])
      expect(smolov.source.notes).toMatch(site);
    expect(smolov.version).not.toBe('');
  });

  it('labels the phases in English and Portuguese', () => {
    const phases = smolov.weeks.map((w) => w.phase?.en);
    expect(phases).toEqual([
      'Introductory microcycle',
      'Introductory microcycle',
      'Base mesocycle',
      'Base mesocycle',
      'Base mesocycle',
      'Base mesocycle',
      'Switching phase',
      'Switching phase',
      'Intense mesocycle',
      'Intense mesocycle',
      'Intense mesocycle',
      'Intense mesocycle',
      'Taper and test',
    ]);
    expect([1, 3, 7, 9, 13].map((w) => smolov.weeks[w - 1].phase?.['pt-BR'])).toEqual([
      'Microciclo introdutório',
      'Mesociclo de base',
      'Fase de transição',
      'Mesociclo intenso',
      'Polimento e teste',
    ]);
  });

  describe('introductory microcycle (weeks 1–2, 3 sessions per week)', () => {
    it('week 1 days 1 and 2: 3×8 @65%, 1×5 @70%, 2×2 @75%, 1×1 @80%', () => {
      const expected = [s(3, 8, 0.65), s(1, 5, 0.7), s(2, 2, 0.75), s(1, 1, 0.8)];
      expect(sets(1, 1)).toEqual(expected);
      expect(sets(1, 2)).toEqual(expected);
    });
    it('week 1 day 3: 4×5 @70%, 1×3 @75%, 2×2 @80%, 1×1 @90%', () => {
      expect(sets(1, 3)).toEqual([s(4, 5, 0.7), s(1, 3, 0.75), s(2, 2, 0.8), s(1, 1, 0.9)]);
    });
    it('week 2: 1×5 @80%, 1×5 @82.5%, 1×5 @85%', () => {
      expect(sets(2, 1)).toEqual([s(1, 5, 0.8)]);
      expect(sets(2, 2)).toEqual([s(1, 5, 0.825)]);
      expect(sets(2, 3)).toEqual([s(1, 5, 0.85)]);
    });
    it('day 4 is a rest day in both weeks', () => {
      isRest(1, 4);
      isRest(2, 4);
    });
  });

  describe('base mesocycle (weeks 3–6, Monday / Wednesday / Friday / Saturday)', () => {
    it('labels the days with the weekdays of the sources', () => {
      for (const week of [3, 4, 5, 6]) {
        expect(smolov.weeks[week - 1].days.map((d) => d.label?.en)).toEqual(['Monday', 'Wednesday', 'Friday', 'Saturday']);
        expect(smolov.weeks[week - 1].days.map((d) => d.label?.['pt-BR'])).toEqual([
          'Segunda-feira',
          'Quarta-feira',
          'Sexta-feira',
          'Sábado',
        ]);
      }
    });
    it('week 3: 4×9 @70%, 5×7 @75%, 7×5 @80%, 10×3 @85%', () => {
      expect(sets(3, 1)).toEqual([s(4, 9, 0.7)]);
      expect(sets(3, 2)).toEqual([s(5, 7, 0.75)]);
      expect(sets(3, 3)).toEqual([s(7, 5, 0.8)]);
      expect(sets(3, 4)).toEqual([s(10, 3, 0.85)]);
    });
    it('week 4: week 3 + 10 kg (20 lb)', () => {
      const add = { kg: 10 };
      expect(sets(4, 1)).toEqual([{ ...s(4, 9, 0.7), addKg: add }]);
      expect(sets(4, 2)).toEqual([{ ...s(5, 7, 0.75), addKg: add }]);
      expect(sets(4, 3)).toEqual([{ ...s(7, 5, 0.8), addKg: add }]);
      expect(sets(4, 4)).toEqual([{ ...s(10, 3, 0.85), addKg: add }]);
    });
    it('week 5: week 3 + 15 kg (30 lb)', () => {
      const add = { kg: 15 };
      expect(sets(5, 1)).toEqual([{ ...s(4, 9, 0.7), addKg: add }]);
      expect(sets(5, 2)).toEqual([{ ...s(5, 7, 0.75), addKg: add }]);
      expect(sets(5, 3)).toEqual([{ ...s(7, 5, 0.8), addKg: add }]);
      expect(sets(5, 4)).toEqual([{ ...s(10, 3, 0.85), addKg: add }]);
    });
    it('week 6: two rest days, then the 1RM test on Friday or Saturday', () => {
      isRest(6, 1);
      isRest(6, 2);
      isTest(6, 3);
      isTest(6, 4);
    });
  });

  describe('switching phase (weeks 7–8)', () => {
    it('is unverified on every day, with a note and no sets to calculate', () => {
      for (const week of [7, 8])
        for (const day of [1, 2, 3, 4]) {
          const line = info(week, day);
          expect(line.unverified).toBe(true);
          expect(line.note?.en).toMatch(/No sets, reps, percentages or frequency confirmed/);
          expect(line.note?.['pt-BR']).not.toBeUndefined();
        }
    });
  });

  describe('intense mesocycle (weeks 9–12, 3 sessions per week)', () => {
    const disputed = (reps: number, repeat: number, text: RegExp, set: SetPrescription) => {
      expect(set).toMatchObject({ reps, unverified: true });
      expect(set.repeat ?? 1).toBe(repeat);
      expect(set.percent).toBeUndefined();
      expect(set.note?.en).toMatch(text);
    };
    it('week 9', () => {
      const [a, b, c, last] = sets(9, 1);
      expect([a, b, c]).toEqual([s(1, 3, 0.65), s(1, 4, 0.75), s(3, 4, 0.85)]);
      expect(sets(9, 1)).toHaveLength(4);
      disputed(5, 1, /85%.*90%/, last);
      expect(sets(9, 2)).toEqual([s(1, 3, 0.6), s(1, 3, 0.7), s(1, 4, 0.8), s(1, 3, 0.9), s(2, 5, 0.85)]);
      expect(sets(9, 3)).toEqual([s(1, 4, 0.65), s(1, 4, 0.7), s(5, 4, 0.8)]);
    });
    it('week 10', () => {
      expect(sets(10, 1)).toEqual([s(1, 4, 0.6), s(1, 4, 0.7), s(1, 4, 0.8), s(1, 3, 0.9), s(2, 4, 0.9)]);
      expect(sets(10, 2)).toEqual([s(1, 3, 0.65), s(1, 3, 0.75), s(1, 3, 0.85), s(3, 3, 0.9), s(1, 3, 0.95)]);
      expect(sets(10, 3)).toEqual([s(1, 3, 0.65), s(1, 3, 0.75), s(1, 4, 0.85), s(4, 5, 0.9)]);
    });
    it('week 11', () => {
      expect(sets(11, 1)).toEqual([s(1, 3, 0.6), s(1, 3, 0.7), s(1, 3, 0.8), s(5, 5, 0.9)]);
      expect(sets(11, 2)).toEqual([s(1, 3, 0.6), s(1, 3, 0.7), s(1, 3, 0.8), s(2, 3, 0.95)]);
      expect(sets(11, 3)).toEqual([s(1, 3, 0.65), s(1, 3, 0.75), s(1, 3, 0.85), s(4, 3, 0.95)]);
    });
    it('week 12', () => {
      expect(sets(12, 1)).toEqual([s(1, 3, 0.7), s(1, 4, 0.8), s(5, 5, 0.9)]);
      expect(sets(12, 2)).toEqual([s(1, 3, 0.7), s(1, 3, 0.8), s(4, 3, 0.95)]);
      const [a, b, last] = sets(12, 3);
      expect([a, b]).toEqual([s(1, 3, 0.75), s(1, 4, 0.9)]);
      expect(sets(12, 3)).toHaveLength(3);
      disputed(4, 3, /95%.*80%/, last);
    });
    it('day 4 is a rest day', () => {
      for (const week of [9, 10, 11, 12]) isRest(week, 4);
    });
    it('reminds that the percentages refer to the new 1RM of week 6', () => {
      for (const week of [9, 10, 11, 12])
        for (const day of [1, 2, 3]) expect((item(week, day) as MainItem).note?.en).toMatch(/new 1RM/);
    });
  });

  describe('taper and test (week 13)', () => {
    it('day 1: 1×3 @70%, 1×3 @80%, 2×5 @90%, 3×4 @95%', () => {
      expect(sets(13, 1)).toEqual([s(1, 3, 0.7), s(1, 3, 0.8), s(2, 5, 0.9), s(3, 4, 0.95)]);
    });
    it('day 2: 1×4 @75%, 4×4 @85%', () => {
      expect(sets(13, 2)).toEqual([s(1, 4, 0.75), s(4, 4, 0.85)]);
    });
    it('day 3: final 1RM test; day 4: rest', () => {
      isTest(13, 3);
      isRest(13, 4);
    });
  });

  it('has no configurable parameter (the base increments are fixed by the original)', () => {
    expect(smolov.configurable).toBeUndefined();
  });

  it('passes the schema validation', () => {
    expect(validateTemplate(smolov)).toEqual([]);
  });
});

describe('smolov blocks', () => {
  it('lets the block start at weeks 1 to 11 (durationWeeks − 2)', () => {
    expect(maxBlockStartWeek(smolov)).toBe(11);
  });

  it.each(Array.from({ length: 13 }, (_, i) => i + 1))('block starting at week %i holds the original weeks', (start) => {
    const block = getBlock(smolov, start);
    const expectedWeeks = Array.from({ length: Math.min(BLOCK_WEEKS, 13 - start + 1) }, (_, i) => start + i);
    expect(block.startWeek).toBe(start);
    expect(block.weeks.map((w) => w.week.week)).toEqual(expectedWeeks);
    expect(block.weeks.map((w) => w.blockWeek)).toEqual(expectedWeeks.map((_, i) => i + 1));
    for (const { week } of block.weeks) expect(week).toBe(smolov.weeks[week.week - 1]);
  });

  it('ends with partial blocks at weeks 12 (2 weeks) and 13 (1 week)', () => {
    expect(getBlock(smolov, 12).weeks).toHaveLength(2);
    expect(getBlock(smolov, 13).weeks).toHaveLength(1);
    expect(() => getBlock(smolov, 14)).toThrow(RangeError);
  });
});

describe('smolov loads', () => {
  const ROUND: RoundingConfig = { incrementKg: 2.5, mode: 'nearest', liftIncrementsKg: {} };
  const generate = (programDay: number, startWeek: number) =>
    generatePeriodization(
      [{ id: 1, lift: 'squat', templateId: 'smolov', programDay, startWeek }],
      [smolov],
      { squat: 200 },
      ROUND,
      {},
    );
  const mainSets = (session: GeneratedSession) => session.items.flatMap((it) => (it.kind === 'main' ? it.sets : []));

  it('adds the fixed base increments: week 3–5 Monday 200 × 0.7 = 140, +10 = 150, +15 = 155', () => {
    const result = generate(1, 3);
    expect(result.weeks.map((w) => mainSets(w.sessions[0])[0])).toEqual([
      expect.objectContaining({ sets: 4, reps: 9, exactKg: 140, roundedKg: 140, addKg: null }),
      expect.objectContaining({ sets: 4, reps: 9, exactKg: 150, roundedKg: 150, addKg: 10 }),
      expect.objectContaining({ sets: 4, reps: 9, exactKg: 155, roundedKg: 155, addKg: 15 }),
    ]);
  });

  it('calculates no load for the unverified switching phase and the disputed sets', () => {
    // block 7–9, day 1: weeks 7 and 8 are unverified info; week 9 day 1 ends with the disputed set
    const result = generate(1, 7);
    const [w7, w8, w9] = result.weeks.map((w) => w.sessions[0]);
    for (const session of [w7, w8]) {
      expect(session.items).toEqual([expect.objectContaining({ kind: 'info', unverified: true })]);
      expect(session.volume).toEqual({ tonnageKg: 0, totalReps: 0 });
      expect(session.warnings).toEqual([{ code: 'unverifiedData' }]);
    }
    // 200 × 0.65 = 130, × 0.75 = 150, × 0.85 = 170; the 1 × 5 set is unverified
    expect(mainSets(w9)).toEqual([
      expect.objectContaining({ exactKg: 130, roundedKg: 130, load: 'calculated' }),
      expect.objectContaining({ exactKg: 150, roundedKg: 150, load: 'calculated' }),
      expect.objectContaining({ sets: 3, reps: 4, exactKg: 170, roundedKg: 170, load: 'calculated' }),
      expect.objectContaining({ sets: 1, reps: 5, percent: null, exactKg: null, roundedKg: null, load: 'unverified' }),
    ]);
    // tonnage 3 × 130 + 4 × 150 + 12 × 170 = 390 + 600 + 2040 = 3030; reps 3 + 4 + 12 + 5 = 24
    expect(w9.volume).toEqual({ tonnageKg: 3030, totalReps: 24 });
    expect(w9.warnings).toEqual([{ code: 'unverifiedData' }]);

    const last = generate(3, 11).weeks[1].sessions[0];
    expect(last.programWeek).toBe(12);
    expect(mainSets(last)[2]).toEqual(expect.objectContaining({ sets: 3, reps: 4, exactKg: null, load: 'unverified' }));
  });

  it('shows rest days and 1RM tests without load or warnings', () => {
    const result = generate(3, 5);
    const [, w6] = result.weeks.map((w) => w.sessions[0]);
    expect(w6.programWeek).toBe(6);
    expect(w6.items).toEqual([expect.objectContaining({ kind: 'info' })]);
    expect(w6.volume).toEqual({ tonnageKg: 0, totalReps: 0 });
    expect(w6.warnings).toEqual([]);
  });
});
