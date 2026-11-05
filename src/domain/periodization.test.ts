import { cycle531Custom } from '@/programs/data/cycle-531-custom';
import type { ProgramTemplate } from '@/programs/schema';

import {
  activationIssues,
  generatePeriodization,
  validateSlot,
  type GeneratedMainItem,
  type GeneratedSession,
  type RoundingConfig,
  type SessionSlotConfig,
} from './periodization';

const ROUND_2_5: RoundingConfig = { incrementKg: 2.5, mode: 'nearest', liftIncrementsKg: {} };

/**
 * Fake multi-day, multi-week template (4 weeks × 2 days, bench or squat). Not a real
 * program: it only exercises the engine (percent, addKg, repeat, unverified sets, fixed-lift
 * and accessory items).
 */
const fake: ProgramTemplate = {
  id: 'fake-multi',
  family: 'smolov-jr',
  name: 'Fake multi',
  version: 'test v1',
  source: { author: 'Test', reference: 'Test fixture', accessedAt: '2026-11-05' },
  verification: 'partial',
  durationWeeks: 4,
  daysPerWeek: 2,
  allowedLifts: ['bench', 'squat'],
  liftSelectable: true,
  configurable: [
    {
      id: 'inc',
      label: { en: 'Increment' },
      unit: 'kg',
      min: 2.5,
      max: 10,
      step: 2.5,
      default: 5,
      source: 'test',
    },
  ],
  weeks: [1, 2, 3, 4].map((week) => ({
    week,
    phase: { en: `Phase ${week}` },
    days: [
      {
        day: 1,
        label: { en: 'Heavy' },
        items: [
          {
            kind: 'main' as const,
            lift: 'selected' as const,
            sets: [
              { reps: 5, percent: [0.7, 0.8, 0.9, 1][week - 1], repeat: 2 },
              { reps: 3, percent: 0.8, addKg: { param: 'inc' } },
            ],
          },
          { kind: 'accessory' as const, name: { en: 'Rows' }, text: { en: '3 x 10' } },
        ],
      },
      {
        day: 2,
        items: [
          {
            kind: 'main' as const,
            lift: 'selected' as const,
            sets: [
              { reps: 4, unverified: true, note: { en: 'Percentage illegible' } },
              { reps: 2, percent: 0.9 },
            ],
          },
          {
            kind: 'main' as const,
            lift: 'bench' as const,
            sets: [{ reps: 6, percent: 0.5, repeat: 3 }],
            note: { en: 'Fixed bench item' },
          },
        ],
      },
    ],
  })),
};

const TEMPLATES = [cycle531Custom, fake];

let nextId = 1;
const slot = (overrides: Partial<SessionSlotConfig> = {}): SessionSlotConfig => ({
  id: nextId++,
  lift: 'bench',
  templateId: 'cycle-531-custom',
  programDay: 1,
  startWeek: 1,
  ...overrides,
});

const sessionsOf = (result: ReturnType<typeof generatePeriodization>, blockWeek: number) =>
  result.weeks[blockWeek - 1].sessions;

const mainItems = (session: GeneratedSession) =>
  session.items.filter((item): item is GeneratedMainItem => item.kind === 'main');

describe('generatePeriodization — custom 5/3/1 (SPEC §13 step 3)', () => {
  it('Bench 100 kg: 3×5 @75% → 75.0, 3×3 @85% → 85.0, 3×1 @95% → 95.0 (2.5 kg)', () => {
    const s = slot({ id: 10 });
    const result = generatePeriodization([s], TEMPLATES, { bench: 100 }, ROUND_2_5, {});
    expect(result.weeks.map((w) => w.blockWeek)).toEqual([1, 2, 3]);
    const expected = [
      // 100 × 0.75 = 75; 100 × 0.85 = 85; 100 × 0.95 = 95 (all multiples of 2.5)
      { week: 1, reps: 5, percent: 0.75, kg: 75 },
      { week: 2, reps: 3, percent: 0.85, kg: 85 },
      { week: 3, reps: 1, percent: 0.95, kg: 95 },
    ];
    for (const { week, reps, percent, kg } of expected) {
      const [session] = sessionsOf(result, week);
      expect(session).toMatchObject({
        key: `10-w${week}`,
        slotId: 10,
        sessionNumber: 1,
        blockWeek: week,
        programWeek: week,
        lift: 'bench',
        templateId: 'cycle-531-custom',
        templateName: '5/3/1 (custom)',
        templateVersion: 'custom — SPEC v1.1',
        verification: 'verified',
        programDay: 1,
        daysPerWeek: 1,
        warnings: [],
      });
      expect(mainItems(session)).toEqual([
        {
          kind: 'main',
          lift: 'bench',
          sets: [
            {
              sets: 3,
              reps,
              percent,
              addKg: null,
              amrap: false,
              exactKg: kg,
              roundedKg: kg,
              load: 'calculated',
            },
          ],
        },
      ]);
      // 3 sets × reps × kg
      expect(session.volume).toEqual({ tonnageKg: 3 * reps * kg, totalReps: 3 * reps });
    }
    expect(result.warnings).toEqual([]);
  });

  it('applies the profile percentages (week 1 at 80%: 100 × 0.8 = 80.0)', () => {
    const result = generatePeriodization([slot()], TEMPLATES, { bench: 100 }, ROUND_2_5, {
      'cycle-531-custom': { week1Percent: 0.8 },
    });
    const set = mainItems(sessionsOf(result, 1)[0])[0].sets[0];
    expect(set).toMatchObject({ percent: 0.8, exactKg: 80, roundedKg: 80 });
  });

  it('mixes lifts: bench 100, squat 140, deadlift 180', () => {
    const slots = [slot({ lift: 'bench' }), slot({ lift: 'squat' }), slot({ lift: 'deadlift' })];
    const result = generatePeriodization(
      slots,
      TEMPLATES,
      { bench: 100, squat: 140, deadlift: 180 },
      ROUND_2_5,
      {},
    );
    const loads = (week: number) =>
      sessionsOf(result, week).map((s) => {
        const set = mainItems(s)[0].sets[0];
        return [s.sessionNumber, s.lift, set.exactKg, set.roundedKg];
      });
    expect(loads(1)).toEqual([
      [1, 'bench', 75, 75],
      [2, 'squat', 105, 105], // 140 × 0.75 = 105
      [3, 'deadlift', 135, 135], // 180 × 0.75 = 135
    ]);
    expect(loads(2)).toEqual([
      [1, 'bench', 85, 85],
      [2, 'squat', 119, 120], // 140 × 0.85 = 119; 119 − 117.5 = 1.5 > 1.25 → 120
      [3, 'deadlift', 153, 152.5], // 180 × 0.85 = 153; 153 − 152.5 = 0.5 < 1.25 → 152.5
    ]);
    expect(loads(3)).toEqual([
      [1, 'bench', 95, 95],
      [2, 'squat', 133, 132.5], // 140 × 0.95 = 133; remainder 0.5 → 132.5
      [3, 'deadlift', 171, 170], // 180 × 0.95 = 171; remainder 1 < 1.25 → 170
    ]);
  });

  it('numbers sessions by slot order, so reordering changes the session number', () => {
    const a = slot({ id: 1, lift: 'bench' });
    const b = slot({ id: 2, lift: 'squat' });
    const oneRms = { bench: 100, squat: 140 };
    const before = generatePeriodization([a, b], TEMPLATES, oneRms, ROUND_2_5, {});
    const after = generatePeriodization([b, a], TEMPLATES, oneRms, ROUND_2_5, {});
    expect(sessionsOf(before, 1).map((s) => [s.slotId, s.sessionNumber])).toEqual([
      [1, 1],
      [2, 2],
    ]);
    expect(sessionsOf(after, 1).map((s) => [s.slotId, s.sessionNumber])).toEqual([
      [2, 1],
      [1, 2],
    ]);
  });

  it('recalculates when the 1RM changes (bench 105: 78.75 → 77.5)', () => {
    const result = generatePeriodization([slot()], TEMPLATES, { bench: 105 }, ROUND_2_5, {});
    // 105 × 0.75 = 78.75; 78.75 − 77.5 = 1.25 = half of 2.5 → tie rounds down → 77.5
    expect(mainItems(sessionsOf(result, 1)[0])[0].sets[0]).toMatchObject({ exactKg: 78.75, roundedKg: 77.5 });
  });
});

describe('generatePeriodization — load arithmetic and rounding', () => {
  it('computes the exact load without floating-point error (100.25 × 0.755 = 75.68875)', () => {
    const result = generatePeriodization([slot()], TEMPLATES, { bench: 100.25 }, ROUND_2_5, {
      'cycle-531-custom': { week1Percent: 0.755 },
    });
    // 75.68875 − 75 = 0.68875 < 1.25 → 75
    expect(mainItems(sessionsOf(result, 1)[0])[0].sets[0]).toMatchObject({
      exactKg: 75.68875,
      roundedKg: 75,
    });
  });

  it('uses the per-lift increment override (bench 101 × 0.75 = 75.75)', () => {
    const own = generatePeriodization([slot()], TEMPLATES, { bench: 101 }, {
      incrementKg: 2.5,
      mode: 'nearest',
      liftIncrementsKg: { bench: 1 },
    }, {});
    // 1 kg: 75.75 − 75 = 0.75 > 0.5 → 76
    expect(mainItems(sessionsOf(own, 1)[0])[0].sets[0].roundedKg).toBe(76);
    const inherited = generatePeriodization([slot()], TEMPLATES, { bench: 101 }, ROUND_2_5, {});
    // 2.5 kg: 75.75 − 75 = 0.75 < 1.25 → 75
    expect(mainItems(sessionsOf(inherited, 1)[0])[0].sets[0].roundedKg).toBe(75);
  });

  it('follows the rounding mode (101 × 0.75 = 75.75: up → 77.5, down → 75)', () => {
    const up = generatePeriodization([slot()], TEMPLATES, { bench: 101 }, { ...ROUND_2_5, mode: 'up' }, {});
    const down = generatePeriodization([slot()], TEMPLATES, { bench: 101 }, { ...ROUND_2_5, mode: 'down' }, {});
    expect(mainItems(sessionsOf(up, 1)[0])[0].sets[0].roundedKg).toBe(77.5);
    expect(mainItems(sessionsOf(down, 1)[0])[0].sets[0].roundedKg).toBe(75);
  });
});

describe('generatePeriodization — generic multi-day, multi-week templates', () => {
  const oneRms = { bench: 100, squat: 142.5 };

  it('calculates percent sets, addKg sets, repeats and passes accessories through', () => {
    const result = generatePeriodization(
      [slot({ id: 7, lift: 'squat', templateId: 'fake-multi', programDay: 1 })],
      TEMPLATES,
      oneRms,
      ROUND_2_5,
      {},
    );
    const [session] = sessionsOf(result, 1);
    expect(session).toMatchObject({
      key: '7-w1',
      programWeek: 1,
      programDay: 1,
      daysPerWeek: 2,
      dayLabel: { en: 'Heavy' },
      phase: { en: 'Phase 1' },
      verification: 'partial',
    });
    expect(session.items).toEqual([
      {
        kind: 'main',
        lift: 'squat',
        sets: [
          // 142.5 × 0.7 = 99.75; 99.75 − 97.5 = 2.25 > 1.25 → 100
          { sets: 2, reps: 5, percent: 0.7, addKg: null, amrap: false, exactKg: 99.75, roundedKg: 100, load: 'calculated' },
          // 142.5 × 0.8 = 114, + 5 (default increment) = 119; 119 − 117.5 = 1.5 > 1.25 → 120
          { sets: 1, reps: 3, percent: 0.8, addKg: 5, amrap: false, exactKg: 119, roundedKg: 120, load: 'calculated' },
        ],
      },
      { kind: 'accessory', name: { en: 'Rows' }, text: { en: '3 x 10' } },
    ]);
    // tonnage = 2 × 5 × 100 + 1 × 3 × 120 = 1000 + 360 = 1360; reps = 10 + 3 = 13
    expect(session.volume).toEqual({ tonnageKg: 1360, totalReps: 13 });
    expect(session.warnings).toEqual([]);
  });

  it('applies the athlete-chosen addKg (7.5: 114 + 7.5 = 121.5 → 122.5)', () => {
    const result = generatePeriodization(
      [slot({ lift: 'squat', templateId: 'fake-multi' })],
      TEMPLATES,
      oneRms,
      ROUND_2_5,
      { 'fake-multi': { inc: 7.5 } },
    );
    // 121.5 − 120 = 1.5 > 1.25 → 122.5
    expect(mainItems(sessionsOf(result, 1)[0])[0].sets[1]).toMatchObject({ addKg: 7.5, exactKg: 121.5, roundedKg: 122.5 });
  });

  it('walks the program weeks of the block (start week 2 → program weeks 2, 3, 4)', () => {
    const result = generatePeriodization(
      [slot({ lift: 'squat', templateId: 'fake-multi', startWeek: 2 })],
      TEMPLATES,
      oneRms,
      ROUND_2_5,
      {},
    );
    const firstSet = (week: number) => mainItems(sessionsOf(result, week)[0])[0].sets[0];
    expect(sessionsOf(result, 1)[0].programWeek).toBe(2);
    expect(sessionsOf(result, 3)[0].programWeek).toBe(4);
    // week 2: 142.5 × 0.8 = 114; 114 − 112.5 = 1.5 > 1.25 → 115
    expect(firstSet(1)).toMatchObject({ percent: 0.8, exactKg: 114, roundedKg: 115 });
    // week 3: 142.5 × 0.9 = 128.25; 128.25 − 127.5 = 0.75 < 1.25 → 127.5
    expect(firstSet(2)).toMatchObject({ percent: 0.9, exactKg: 128.25, roundedKg: 127.5 });
    // week 4: 142.5 × 1.0 = 142.5 (multiple of 2.5)
    expect(firstSet(3)).toMatchObject({ percent: 1, exactKg: 142.5, roundedKg: 142.5 });
  });

  it('calculates no load for unverified prescriptions and flags the session', () => {
    const result = generatePeriodization(
      [slot({ lift: 'squat', templateId: 'fake-multi', programDay: 2 })],
      TEMPLATES,
      oneRms,
      ROUND_2_5,
      {},
    );
    const [session] = sessionsOf(result, 1);
    const [squat, bench] = mainItems(session);
    expect(squat.sets).toEqual([
      {
        sets: 1,
        reps: 4,
        percent: null,
        addKg: null,
        amrap: false,
        exactKg: null,
        roundedKg: null,
        load: 'unverified',
        note: { en: 'Percentage illegible' },
      },
      // 142.5 × 0.9 = 128.25 → 127.5
      { sets: 1, reps: 2, percent: 0.9, addKg: null, amrap: false, exactKg: 128.25, roundedKg: 127.5, load: 'calculated' },
    ]);
    // A fixed-lift item uses its own lift's 1RM: 100 × 0.5 = 50
    expect(bench).toMatchObject({ lift: 'bench', note: { en: 'Fixed bench item' } });
    expect(bench.sets[0]).toMatchObject({ sets: 3, reps: 6, exactKg: 50, roundedKg: 50 });
    expect(session.warnings).toEqual([{ code: 'unverifiedData' }]);
    // tonnage: squat 2 × 127.5 = 255 (the unverified set adds reps, not load); bench 3 × 6 × 50 = 900
    expect(session.volume).toEqual({ tonnageKg: 1155, totalReps: 4 + 2 + 18 });
    expect(session.volumeByLift).toEqual({
      squat: { tonnageKg: 255, totalReps: 6 },
      bench: { tonnageKg: 900, totalReps: 18 },
    });
  });

  it('calculates no load for a set marked unverified even if it carries a percentage', () => {
    const template: ProgramTemplate = {
      ...cycle531Custom,
      id: 'unverified-percent',
      verification: 'partial',
      weeks: cycle531Custom.weeks.map((w) => ({
        ...w,
        days: [{ day: 1, items: [{ kind: 'main', lift: 'selected', sets: [{ reps: 5, percent: 0.7, unverified: true, note: { en: 'Doubtful' } }] }] }],
      })),
    };
    const result = generatePeriodization(
      [slot({ templateId: 'unverified-percent' })],
      [template],
      { bench: 100 },
      ROUND_2_5,
      {},
    );
    expect(mainItems(sessionsOf(result, 1)[0])[0].sets[0]).toMatchObject({
      percent: 0.7,
      exactKg: null,
      roundedKg: null,
      load: 'unverified',
    });
  });

  it('calculates no load when an addKg parameter cannot be resolved', () => {
    const template: ProgramTemplate = {
      ...fake,
      id: 'dangling',
      configurable: [],
    };
    const result = generatePeriodization(
      [slot({ lift: 'squat', templateId: 'dangling' })],
      [template],
      oneRms,
      ROUND_2_5,
      {},
    );
    expect(mainItems(sessionsOf(result, 1)[0])[0].sets[1]).toMatchObject({
      addKg: null,
      exactKg: null,
      roundedKg: null,
      load: 'unverified',
    });
  });

  it('keeps the amrap flag of a set', () => {
    const template: ProgramTemplate = {
      ...cycle531Custom,
      id: 'amrap',
      configurable: [],
      weeks: cycle531Custom.weeks.map((w) => ({
        ...w,
        days: [{ day: 1, items: [{ kind: 'main', lift: 'selected', sets: [{ reps: 5, percent: 0.7, amrap: true }] }] }],
      })),
    };
    const result = generatePeriodization([slot({ templateId: 'amrap' })], [template], { bench: 100 }, ROUND_2_5, {});
    expect(mainItems(sessionsOf(result, 1)[0])[0].sets[0]).toMatchObject({ amrap: true, exactKg: 70, roundedKg: 70 });
  });
});

describe('generatePeriodization — warnings', () => {
  it('missing 1RM: no load, a session warning and one periodization warning per lift', () => {
    const slots = [slot({ lift: 'deadlift' }), slot({ lift: 'deadlift' }), slot({ lift: 'bench' })];
    const result = generatePeriodization(slots, TEMPLATES, { bench: 100 }, ROUND_2_5, {});
    const [first] = sessionsOf(result, 1);
    expect(mainItems(first)[0].sets[0]).toMatchObject({
      percent: 0.75,
      exactKg: null,
      roundedKg: null,
      load: 'missingOneRm',
    });
    expect(first.warnings).toEqual([{ code: 'missingOneRm', lift: 'deadlift' }]);
    // reps still count: 3 × 5 = 15; no tonnage without a load
    expect(first.volume).toEqual({ tonnageKg: 0, totalReps: 15 });
    expect(result.warnings).toEqual([{ code: 'missingOneRm', lift: 'deadlift' }]);
  });

  it('warns about an incomplete program frequency, per template and lift', () => {
    const result = generatePeriodization(
      [
        slot({ lift: 'squat', templateId: 'fake-multi', programDay: 1 }),
        slot({ lift: 'squat', templateId: 'fake-multi', programDay: 1 }),
        slot({ lift: 'bench', templateId: 'fake-multi', programDay: 1 }),
        slot({ lift: 'bench', templateId: 'fake-multi', programDay: 2 }),
      ],
      TEMPLATES,
      { bench: 100, squat: 142.5 },
      ROUND_2_5,
      {},
    );
    expect(result.warnings).toEqual([
      { code: 'incompleteFrequency', templateId: 'fake-multi', lift: 'squat', configured: 1, prescribed: 2 },
    ]);
  });

  it('rejects invalid slots with a reason and still counts their session number', () => {
    const slots = [
      slot({ id: 1, templateId: 'nope' }),
      slot({ id: 2, lift: 'deadlift', templateId: 'fake-multi' }),
      slot({ id: 3, lift: 'squat', templateId: 'fake-multi', programDay: 3 }),
      slot({ id: 4, lift: 'squat', templateId: 'fake-multi', startWeek: 5 }),
      slot({ id: 5, lift: 'squat', templateId: 'fake-multi', startWeek: 0 }),
      slot({ id: 6, lift: 'squat', templateId: 'fake-multi', programDay: 1.5 }),
      slot({ id: 7, lift: 'bench' }),
    ];
    const result = generatePeriodization(slots, TEMPLATES, { bench: 100, squat: 100 }, ROUND_2_5, {});
    expect(result.warnings).toEqual([
      { code: 'invalidSlot', slotId: 1, sessionNumber: 1, reason: 'unknownTemplate' },
      { code: 'invalidSlot', slotId: 2, sessionNumber: 2, reason: 'liftNotAllowed' },
      { code: 'invalidSlot', slotId: 3, sessionNumber: 3, reason: 'invalidProgramDay' },
      { code: 'invalidSlot', slotId: 4, sessionNumber: 4, reason: 'invalidStartWeek' },
      { code: 'invalidSlot', slotId: 5, sessionNumber: 5, reason: 'invalidStartWeek' },
      { code: 'invalidSlot', slotId: 6, sessionNumber: 6, reason: 'invalidProgramDay' },
    ]);
    expect(sessionsOf(result, 1).map((s) => [s.slotId, s.sessionNumber])).toEqual([[7, 7]]);
  });

  it('shows only the existing weeks of a partial block at the end of a program', () => {
    const result = generatePeriodization(
      [slot({ id: 3, lift: 'squat', templateId: 'fake-multi', startWeek: 4, programDay: 1 }), slot({ id: 4, lift: 'squat', templateId: 'fake-multi', startWeek: 4, programDay: 2 })],
      TEMPLATES,
      { bench: 100, squat: 142.5 },
      ROUND_2_5,
      {},
    );
    expect(result.weeks.map((w) => w.sessions.map((s) => s.programWeek))).toEqual([[4, 4], [], []]);
    expect(result.warnings).toEqual([
      { code: 'partialBlock', slotId: 3, sessionNumber: 1, weeks: 1 },
      { code: 'partialBlock', slotId: 4, sessionNumber: 2, weeks: 1 },
    ]);
  });
});

describe('generatePeriodization — volume aggregates', () => {
  it('sums tonnage and reps per week, per lift per week and for the block', () => {
    const result = generatePeriodization(
      [slot({ lift: 'bench' }), slot({ lift: 'squat' }), slot({ lift: 'bench' })],
      TEMPLATES,
      { bench: 100, squat: 140 },
      ROUND_2_5,
      {},
    );
    // week 1: bench 2 × (3 × 5 × 75 = 1125) = 2250, 30 reps; squat 3 × 5 × 105 = 1575, 15 reps
    expect(result.weeks[0].volume).toEqual({ tonnageKg: 3825, totalReps: 45 });
    expect(result.weeks[0].volumeByLift).toEqual({
      bench: { tonnageKg: 2250, totalReps: 30 },
      squat: { tonnageKg: 1575, totalReps: 15 },
    });
    // week 2: bench 2 × (3 × 3 × 85 = 765) = 1530, 18 reps; squat 3 × 3 × 120 = 1080, 9 reps
    expect(result.weeks[1].volume).toEqual({ tonnageKg: 2610, totalReps: 27 });
    // week 3: bench 2 × (3 × 1 × 95 = 285) = 570, 6 reps; squat 3 × 1 × 132.5 = 397.5, 3 reps
    expect(result.weeks[2].volume).toEqual({ tonnageKg: 967.5, totalReps: 9 });
    // block: bench 2250 + 1530 + 570 = 4350 (54 reps); squat 1575 + 1080 + 397.5 = 3052.5 (27 reps)
    expect(result.volumeByLift).toEqual({
      bench: { tonnageKg: 4350, totalReps: 54 },
      squat: { tonnageKg: 3052.5, totalReps: 27 },
    });
    expect(result.volume).toEqual({ tonnageKg: 7402.5, totalReps: 81 });
  });

  it('returns three empty weeks for no slots', () => {
    const result = generatePeriodization([], TEMPLATES, {}, ROUND_2_5, {});
    expect(result).toEqual({
      weeks: [1, 2, 3].map((blockWeek) => ({
        blockWeek,
        sessions: [],
        volume: { tonnageKg: 0, totalReps: 0 },
        volumeByLift: {},
      })),
      volume: { tonnageKg: 0, totalReps: 0 },
      volumeByLift: {},
      warnings: [],
    });
  });
});

describe('generatePeriodization — performance', () => {
  it('generates 10 slots in under 50 ms', () => {
    const slots = Array.from({ length: 10 }, (_, i) =>
      i % 2 === 0
        ? slot({ lift: 'squat', templateId: 'fake-multi', programDay: (i % 4) / 2 + 1, startWeek: 2 })
        : slot({ lift: i % 3 === 0 ? 'deadlift' : 'bench' }),
    );
    const oneRms = { bench: 100, squat: 142.5, deadlift: 180 };
    generatePeriodization(slots, TEMPLATES, oneRms, ROUND_2_5, {}); // warm-up
    const start = performance.now();
    const result = generatePeriodization(slots, TEMPLATES, oneRms, ROUND_2_5, {});
    expect(performance.now() - start).toBeLessThan(50);
    expect(result.weeks[0].sessions).toHaveLength(10);
  });
});

describe('validateSlot', () => {
  it('returns null for a slot inside its program, else the issue code', () => {
    expect(validateSlot(slot({ lift: 'squat', templateId: 'fake-multi', programDay: 2, startWeek: 4 }), TEMPLATES)).toBeNull();
    expect(validateSlot(slot({ templateId: 'nope' }), TEMPLATES)).toBe('unknownTemplate');
    expect(validateSlot(slot({ lift: 'deadlift', templateId: 'fake-multi' }), TEMPLATES)).toBe('liftNotAllowed');
    expect(validateSlot(slot({ programDay: 2 }), TEMPLATES)).toBe('invalidProgramDay');
    expect(validateSlot(slot({ startWeek: 4 }), TEMPLATES)).toBe('invalidStartWeek');
  });
});

describe('activationIssues', () => {
  it('blocks activation without sessions, with a missing 1RM or an invalid slot', () => {
    const empty = generatePeriodization([], TEMPLATES, {}, ROUND_2_5, {});
    expect(activationIssues(empty)).toEqual(['noSessions']);
    const missing = generatePeriodization([slot({ lift: 'squat' }), slot({ templateId: 'nope' })], TEMPLATES, {}, ROUND_2_5, {});
    expect(activationIssues(missing)).toEqual(['missingOneRm', 'invalidSlot']);
  });

  it('allows activation with only informational warnings (frequency, partial block, unverified)', () => {
    const result = generatePeriodization(
      [slot({ lift: 'squat', templateId: 'fake-multi', programDay: 2, startWeek: 4 })],
      TEMPLATES,
      { bench: 100, squat: 100 },
      ROUND_2_5,
      {},
    );
    expect(result.warnings.map((w) => w.code)).toEqual(['partialBlock', 'incompleteFrequency']);
    expect(activationIssues(result)).toEqual([]);
  });
});
