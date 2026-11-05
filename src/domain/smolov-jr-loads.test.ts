import { cycle531Custom } from '@/programs/data/cycle-531-custom';
import { smolovJr } from '@/programs/data/smolov-jr';

import { generatePeriodization, type RoundingConfig } from './periodization';

/** Smolov Jr. (Stage 7) through the generator: week 2–3 loads with the weekly increment. */
describe('smolov-jr loads (generator)', () => {
  const ROUND_2_5: RoundingConfig = { incrementKg: 2.5, mode: 'nearest', liftIncrementsKg: {} };
  const allDays = [1, 2, 3, 4].map((day) => ({ id: day, lift: 'squat' as const, templateId: 'smolov-jr', programDay: day, startWeek: 1 }));

  /** [blockWeek][day] → [sets, reps, exactKg, roundedKg] */
  function loads(oneRm: number, params: Record<string, number>) {
    const result = generatePeriodization(allDays, [smolovJr], { squat: oneRm }, ROUND_2_5, { 'smolov-jr': params });
    return result.weeks.map((week) =>
      week.sessions.map((session) => {
        const item = session.items[0];
        if (item.kind !== 'main') throw new Error('expected a main item');
        const [set] = item.sets;
        return [set.sets, set.reps, set.exactKg, set.roundedKg];
      }),
    );
  }

  it('squat 1RM 140, default increment 2.5 kg', () => {
    // Week 1: 140 × .70 = 98 → 97.5 (0.5 < 1.25); × .75 = 105; × .80 = 112; × .85 = 119 → 120 (1.5 > 1.25)
    // Week 2: + 2.5 → 100.5 → 100; 107.5; 114.5 → 115; 121.5 → 122.5
    // Week 3: + 5   → 103 → 102.5; 110; 117 → 117.5; 124 → 125
    expect(loads(140, {})).toEqual([
      [[6, 6, 98, 97.5], [7, 5, 105, 105], [8, 4, 112, 112.5], [10, 3, 119, 120]],
      [[6, 6, 100.5, 100], [7, 5, 107.5, 107.5], [8, 4, 114.5, 115], [10, 3, 121.5, 122.5]],
      [[6, 6, 103, 102.5], [7, 5, 110, 110], [8, 4, 117, 117.5], [10, 3, 124, 125]],
    ]);
  });

  it('squat 1RM 140, chosen increment 5 kg (week 3 adds 10 kg)', () => {
    // Week 2: 103 → 102.5; 110; 117 → 117.5; 124 → 125
    // Week 3: 108 → 107.5; 115; 122 → 122.5; 129 → 130
    expect(loads(140, { weeklyIncrementKg: 5 })).toEqual([
      [[6, 6, 98, 97.5], [7, 5, 105, 105], [8, 4, 112, 112.5], [10, 3, 119, 120]],
      [[6, 6, 103, 102.5], [7, 5, 110, 110], [8, 4, 117, 117.5], [10, 3, 124, 125]],
      [[6, 6, 108, 107.5], [7, 5, 115, 115], [8, 4, 122, 122.5], [10, 3, 129, 130]],
    ]);
  });

  it('ignores an out-of-range increment and uses the default instead', () => {
    expect(loads(140, { weeklyIncrementKg: 10 })).toEqual(loads(140, {}));
  });
});

/** SPEC §13 step 2: Session 1 = Bench / custom 5/3/1, Session 2 = Bench / Smolov Jr. day 1 (Bench 1RM 100). */
describe('SPEC §13 configuration: Session 2 = Bench / Smolov Jr. day 1', () => {
  const ROUND_2_5: RoundingConfig = { incrementKg: 2.5, mode: 'nearest', liftIncrementsKg: {} };
  const slots = [
    { id: 1, lift: 'bench' as const, templateId: 'cycle-531-custom', programDay: 1, startWeek: 1 },
    { id: 2, lift: 'bench' as const, templateId: 'smolov-jr', programDay: 1, startWeek: 1 },
  ];
  const oneRms = { bench: 100, squat: 140, deadlift: 180 };

  function session2(params = {}) {
    const result = generatePeriodization(slots, [cycle531Custom, smolovJr], oneRms, ROUND_2_5, params);
    return result.weeks.map((week) => {
      const session = week.sessions.find((s) => s.sessionNumber === 2);
      if (!session) throw new Error('missing session 2');
      return session;
    });
  }

  it('generates 6 × 6 @ 70% → 70.0 / 72.5 / 75.0 kg with the default 2.5 kg increment', () => {
    // 100 × 0.70 = 70; week 2: 70 + 2.5 = 72.5; week 3: 70 + 2 × 2.5 = 75 (all on the 2.5 kg step)
    expect(
      session2().map((session) => {
        const item = session.items[0];
        if (item.kind !== 'main') throw new Error('expected a main item');
        return [session.programWeek, session.programDay, item.lift, item.sets];
      }),
    ).toEqual([
      [1, 1, 'bench', [{ sets: 6, reps: 6, percent: 0.7, addKg: null, amrap: false, exactKg: 70, roundedKg: 70, load: 'calculated' }]],
      [2, 1, 'bench', [{ sets: 6, reps: 6, percent: 0.7, addKg: 2.5, amrap: false, exactKg: 72.5, roundedKg: 72.5, load: 'calculated' }]],
      [3, 1, 'bench', [{ sets: 6, reps: 6, percent: 0.7, addKg: 5, amrap: false, exactKg: 75, roundedKg: 75, load: 'calculated' }]],
    ]);
    // tonnage 36 reps × 70 = 2520; × 72.5 = 2610; × 75 = 2700
    expect(session2().map((s) => s.volume)).toEqual([
      { tonnageKg: 2520, totalReps: 36 },
      { tonnageKg: 2610, totalReps: 36 },
      { tonnageKg: 2700, totalReps: 36 },
    ]);
  });

  it('applies a chosen 4 kg increment: 70 / 74 → 75 (1.5 > 1.25) / 78 → 77.5 (0.5 < 1.25)', () => {
    const rounded = session2({ 'smolov-jr': { weeklyIncrementKg: 4 } }).map((session) => {
      const item = session.items[0];
      if (item.kind !== 'main') throw new Error('expected a main item');
      return [item.sets[0].exactKg, item.sets[0].roundedKg];
    });
    expect(rounded).toEqual([
      [70, 70],
      [74, 75],
      [78, 77.5],
    ]);
  });

  it('warns that Smolov Jr. prescribes 4 sessions per week and only 1 is configured', () => {
    const result = generatePeriodization(slots, [cycle531Custom, smolovJr], oneRms, ROUND_2_5, {});
    expect(result.warnings).toEqual([
      { code: 'incompleteFrequency', templateId: 'smolov-jr', lift: 'bench', configured: 1, prescribed: 4 },
    ]);
  });
});
