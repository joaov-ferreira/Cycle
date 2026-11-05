import { cycle531Custom } from '@/programs/data/cycle-531-custom';
import { sheiko29 } from '@/programs/data/sheiko-29';
import { sheiko32 } from '@/programs/data/sheiko-32';
import { smolovJr } from '@/programs/data/smolov-jr';

import {
  generatePeriodization,
  type GeneratedMainItem,
  type GeneratedSession,
  type RoundingConfig,
  type SessionSlotConfig,
} from './periodization';

/** Sheiko (Stage 9) through the generator: multi-lift days filtered by the slot lift. */
describe('sheiko loads (generator)', () => {
  const ROUND_2_5: RoundingConfig = { incrementKg: 2.5, mode: 'nearest', liftIncrementsKg: {} };
  const TEMPLATES = [cycle531Custom, smolovJr, sheiko29, sheiko32];
  const ONE_RMS = { bench: 100, squat: 140, deadlift: 180 };

  /** SPEC §13 step 2: sessions 1–3 as specified, session 4 = Deadlift / Sheiko #29, day 2 (Wednesday). */
  const SPEC_SLOTS: SessionSlotConfig[] = [
    { id: 1, lift: 'bench', templateId: 'cycle-531-custom', programDay: 1, startWeek: 1 },
    { id: 2, lift: 'bench', templateId: 'smolov-jr', programDay: 1, startWeek: 1 },
    { id: 3, lift: 'squat', templateId: 'cycle-531-custom', programDay: 1, startWeek: 1 },
    { id: 4, lift: 'deadlift', templateId: 'sheiko-29', programDay: 2, startWeek: 1 },
  ];

  const mains = (session: GeneratedSession) =>
    session.items.filter((item): item is GeneratedMainItem => item.kind === 'main');

  /** [exercise, [sets, reps, percent, exactKg, roundedKg][]] per main item. */
  const table = (session: GeneratedSession) =>
    mains(session).map((item) => [
      item.exercise?.en ?? item.lift,
      item.sets.map((set) => [set.sets, set.reps, set.percent, set.exactKg, set.roundedKg]),
    ]);

  const session4 = (blockWeek: number) => {
    const result = generatePeriodization(SPEC_SLOTS, TEMPLATES, ONE_RMS, ROUND_2_5, {});
    const session = result.weeks[blockWeek - 1].sessions.find((candidate) => candidate.sessionNumber === 4);
    if (!session) throw new Error('session 4 missing');
    return { result, session };
  };

  describe('SPEC §13 Session 4: Deadlift / Sheiko #29, day 2 (deadlift 1RM 180 kg, 2.5 kg, nearest)', () => {
    it('week 1: deadlift up to knees and from boxes, with exact → rounded loads', () => {
      const { session } = session4(1);
      expect(session).toMatchObject({ lift: 'deadlift', templateName: 'Sheiko #29', programWeek: 1, programDay: 2 });
      expect(session.dayLabel?.en).toBe('Wednesday');
      // 180 × .50 = 90; × .60 = 108 → 107.5 (0.5 < 1.25); × .70 = 126 → 125 (1 < 1.25); × .75 = 135;
      // × .55 = 99 → 100 (97.5 is 1.5 away); × .65 = 117 → 117.5 (0.5); × .85 = 153 → 152.5 (0.5)
      expect(table(session)).toEqual([
        [
          'Deadlift up to knees',
          [
            [1, 3, 0.5, 90, 90],
            [2, 3, 0.6, 108, 107.5],
            [2, 3, 0.7, 126, 125],
            [4, 3, 0.75, 135, 135],
          ],
        ],
        [
          'Deadlift from boxes',
          [
            [1, 4, 0.55, 99, 100],
            [1, 4, 0.65, 117, 117.5],
            [2, 4, 0.75, 135, 135],
            [4, 3, 0.85, 153, 152.5],
          ],
        ],
      ]);
      // accessories are listed, never calculated
      expect(session.items.filter((item) => item.kind === 'accessory').map((item) => item.kind === 'accessory' && item.name.en)).toEqual([
        'Incline bench press',
        'Dip',
        'Lunge',
        'Abs',
      ]);
      expect(session.otherItems).toEqual([]);
      // 3×90 + 6×107.5 + 6×125 + 12×135 = 3,285; 4×100 + 4×117.5 + 8×135 + 12×152.5 = 3,780
      expect(session.volume).toEqual({ tonnageKg: 7065, totalReps: 55 });
      expect(session.warnings).toEqual([]);
    });

    it('week 2: the bench press of the day is information only; deadlift loads are calculated', () => {
      const { session } = session4(2);
      // 180 × .80 = 144 → 145 (142.5 is 1.5 away)
      expect(table(session)).toEqual([
        [
          'Deadlift up to knees',
          [
            [1, 3, 0.5, 90, 90],
            [1, 3, 0.6, 108, 107.5],
            [2, 3, 0.7, 126, 125],
            [4, 2, 0.75, 135, 135],
          ],
        ],
        [
          'Deadlift from boxes',
          [
            [1, 4, 0.55, 99, 100],
            [1, 4, 0.65, 117, 117.5],
            [2, 4, 0.75, 135, 135],
            [4, 4, 0.8, 144, 145],
          ],
        ],
      ]);
      expect(session.otherItems).toEqual([
        {
          kind: 'main',
          lift: 'bench',
          sets: [
            { reps: 6, percent: 0.5 },
            { repeat: 2, reps: 6, percent: 0.6 },
            { repeat: 4, reps: 6, percent: 0.65 },
          ],
        },
      ]);
      // 270 + 322.5 + 750 + 1,080 = 2,422.5; 400 + 470 + 1,080 + 2,320 = 4,270
      expect(session.volume).toEqual({ tonnageKg: 6692.5, totalReps: 52 });
      expect(session.volumeByLift).toEqual({ deadlift: { tonnageKg: 6692.5, totalReps: 52 } });
    });

    it('week 3: deficit deadlift and deadlift from boxes up to 90%', () => {
      const { session } = session4(3);
      // × .65 = 117 → 117.5; × .90 = 162 → 162.5 (0.5)
      expect(table(session)).toEqual([
        [
          'Deficit deadlift',
          [
            [2, 3, 0.5, 90, 90],
            [2, 3, 0.6, 108, 107.5],
            [4, 3, 0.65, 117, 117.5],
          ],
        ],
        [
          'Deadlift from boxes',
          [
            [1, 4, 0.6, 108, 107.5],
            [2, 4, 0.7, 126, 125],
            [2, 3, 0.8, 144, 145],
            [3, 2, 0.9, 162, 162.5],
          ],
        ],
      ]);
      // 540 + 645 + 1,410 = 2,595; 430 + 1,000 + 870 + 975 = 3,275
      expect(session.volume).toEqual({ tonnageKg: 5870, totalReps: 48 });
    });

    it('keeps sessions 1–3 unchanged and warns that 1 of the 3 Sheiko days is configured', () => {
      const { result } = session4(1);
      const [s1, s2, s3] = result.weeks[0].sessions;
      expect(mains(s1)[0].sets[0]).toMatchObject({ exactKg: 75, roundedKg: 75 });
      expect(mains(s2)[0].sets[0]).toMatchObject({ exactKg: 70, roundedKg: 70 });
      expect(mains(s3)[0].sets[0]).toMatchObject({ exactKg: 105, roundedKg: 105 });
      expect(result.weeks[0].volumeByLift.deadlift).toEqual({ tonnageKg: 7065, totalReps: 55 });
      expect(result.warnings).toEqual([
        { code: 'incompleteFrequency', templateId: 'smolov-jr', lift: 'bench', configured: 1, prescribed: 4 },
        { code: 'incompleteFrequency', templateId: 'sheiko-29', lift: 'deadlift', configured: 1, prescribed: 3 },
      ]);
    });
  });

  it('warns when the chosen Sheiko day has no deadlift work (#29 Monday, weeks 1–3)', () => {
    const result = generatePeriodization(
      [{ id: 1, lift: 'deadlift', templateId: 'sheiko-29', programDay: 1, startWeek: 1 }],
      TEMPLATES,
      ONE_RMS,
      ROUND_2_5,
      {},
    );
    for (const week of result.weeks) {
      const [session] = week.sessions;
      expect(mains(session)).toEqual([]);
      expect(session.volume).toEqual({ tonnageKg: 0, totalReps: 0 });
      expect(session.warnings).toEqual([{ code: 'liftNotInDay' }]);
      expect(session.otherItems.length).toBeGreaterThan(0);
    }
  });

  it('#32 max-test day: loads up to 90%, the unverified max attempts have none', () => {
    const result = generatePeriodization(
      [{ id: 1, lift: 'deadlift', templateId: 'sheiko-32', programDay: 2, startWeek: 1 }],
      TEMPLATES,
      ONE_RMS,
      ROUND_2_5,
      {},
    );
    const [session] = result.weeks[0].sessions;
    // 180 × .5 = 90; × .6 = 108 → 107.5; × .7 = 126 → 125; × .8 = 144 → 145; × .9 = 162 → 162.5
    expect(table(session)).toEqual([
      [
        'deadlift',
        [
          [1, 3, 0.5, 90, 90],
          [1, 2, 0.6, 108, 107.5],
          [2, 2, 0.7, 126, 125],
          [1, 1, 0.8, 144, 145],
          [1, 1, 0.9, 162, 162.5],
        ],
      ],
    ]);
    const attempts = session.items.find((item) => item.kind === 'info');
    expect(attempts).toMatchObject({ kind: 'info', lift: 'deadlift', unverified: true });
    expect(session.warnings).toEqual([{ code: 'unverifiedData' }]);
    // the squat and bench work (and their own max attempts) are information for this slot
    expect(session.otherItems.map((item) => `${item.kind}:${item.lift}`)).toEqual([
      'main:squat',
      'info:squat',
      'main:bench',
      'info:bench',
    ]);
    // 270 + 215 + 500 + 145 + 162.5 = 1,292.5
    expect(session.volume).toEqual({ tonnageKg: 1292.5, totalReps: 11 });
  });
});
