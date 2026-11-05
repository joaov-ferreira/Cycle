import type { SetRecord } from '../performance';
import type { GeneratedSession } from '../periodization';
import { compareE1rm, sessionE1rmCandidates, sessionEstimates, type E1rmCandidate } from './session';

const c = (position: number, weightKg: number, reps: number, rir: number | null, lift: E1rmCandidate['lift'] = 'bench'): E1rmCandidate => ({
  position,
  lift,
  weightKg,
  reps,
  rir,
  rpe: rir === null ? null : 10 - rir,
});

describe('sessionEstimates — representative set (SPEC §8.3)', () => {
  it('a multi-set session yields a single estimate per lift (SPEC §13 step 4)', () => {
    // 75 × 5 (no RIR), 75 × 5 (no RIR), 80 × 5 @ RIR 1 → only the last is valid: 80 / 0.837 = 95.6
    const result = sessionEstimates([c(0, 75, 5, null), c(1, 75, 5, null), c(2, 80, 5, 1)], 'rts');
    expect(result).toEqual([
      { lift: 'bench', formula: 'rts', e1rmKg: 95.6, repsToFailure: 6, position: 2, weightKg: 80, reps: 5, rir: 1 },
    ]);
  });

  it('picks the valid set with the smallest n, even when another set gives a higher e1RM', () => {
    // 100 × 3 @ RIR 1: n = 4, epley 100 × (1 + 4/30) = 113.3
    //  90 × 1 @ RIR 0: n = 1, epley = 90.0  ← smallest n
    const [estimate] = sessionEstimates([c(0, 100, 3, 1), c(1, 90, 1, 0)], 'epley-rir');
    expect(estimate).toMatchObject({ position: 1, e1rmKg: 90, repsToFailure: 1 });
  });

  it('tie on n → the heaviest weight', () => {
    // 100 × 3 @ RIR 1 (n = 4) vs 105 × 2 @ RIR 2 (n = 4): 105 × (1 + 4/30) = 119.0
    const [estimate] = sessionEstimates([c(0, 100, 3, 1), c(1, 105, 2, 2)], 'epley-rir');
    expect(estimate).toMatchObject({ position: 1, weightKg: 105, e1rmKg: 119 });
  });

  it('tie on n and weight → the lowest RIR', () => {
    // 100 × 2 @ RIR 2 (n = 4) vs 100 × 3 @ RIR 1 (n = 4): RIR 1 wins although it comes second
    const [estimate] = sessionEstimates([c(0, 100, 2, 2), c(1, 100, 3, 1)], 'epley-rir');
    expect(estimate).toMatchObject({ position: 1, reps: 3, rir: 1 });
  });

  it('tie on n, weight and RIR → the first set', () => {
    const [estimate] = sessionEstimates([c(3, 100, 3, 1), c(4, 100, 3, 1)], 'epley-rir');
    expect(estimate.position).toBe(3);
  });

  it('ignores sets that are not valid (low confidence, failure, no effort)', () => {
    const sets = [
      c(0, 120, 1, 5), // RIR 5: low confidence
      c(1, 130, 0, 0), // failure
      c(2, 125, 1, null), // no RIR/RPE
      c(3, 50, 10, 3), // n = 13: low confidence
      c(4, 100, 3, 1), // valid: 100 / pct(3, RPE 9) = 100 / 0.892 = 112.107… → 112.1
    ];
    expect(sessionEstimates(sets, 'rts')).toEqual([
      { lift: 'bench', formula: 'rts', e1rmKg: 112.1, repsToFailure: 4, position: 4, weightKg: 100, reps: 3, rir: 1 },
    ]);
  });

  it('returns nothing when no set is valid', () => {
    expect(sessionEstimates([c(0, 100, 5, 5), c(1, 100, 0, 0)], 'rts')).toEqual([]);
    expect(sessionEstimates([], 'rts')).toEqual([]);
  });

  it('gives one estimate per lift, in lift order', () => {
    // squat 140 × 2 @ RIR 1 (n = 3): 140 / 0.922 = 151.843… → 151.8; bench 80 × 5 @ RIR 1: 95.6
    const result = sessionEstimates([c(0, 140, 2, 1, 'squat'), c(1, 80, 5, 1, 'bench'), c(2, 70, 5, 1, 'bench')], 'rts');
    expect(result.map((e) => [e.lift, e.e1rmKg, e.position])).toEqual([
      ['bench', 95.6, 1],
      ['squat', 151.8, 0],
    ]);
  });

  it('stores the formula it used', () => {
    expect(sessionEstimates([c(0, 80, 5, 1)], 'brzycki-rir')[0]).toMatchObject({ formula: 'brzycki-rir', e1rmKg: 92.9 });
  });
});

function session(): GeneratedSession {
  return {
    key: '1-w1',
    slotId: 1,
    sessionNumber: 1,
    blockWeek: 1,
    programWeek: 1,
    lift: 'deadlift',
    templateId: 'sheiko-29',
    templateName: 'Sheiko #29',
    templateVersion: 'v',
    verification: 'partial',
    programDay: 2,
    daysPerWeek: 3,
    items: [
      {
        kind: 'main',
        lift: 'deadlift',
        exercise: { en: 'Deadlift from boxes' },
        sets: [{ sets: 1, reps: 3, percent: 0.8, addKg: null, amrap: false, exactKg: 144, roundedKg: 145, load: 'calculated' }],
      },
      {
        kind: 'main',
        lift: 'deadlift',
        sets: [{ sets: 2, reps: 2, percent: 0.85, addKg: null, amrap: false, exactKg: 153, roundedKg: 152.5, load: 'calculated' }],
      },
    ],
    otherItems: [],
    volume: { tonnageKg: 0, totalReps: 7 },
    volumeByLift: {},
    warnings: [],
  };
}

const record = (prescribedIndex: number | null, weightKg: number | null, reps: number | null, rir: number | null): SetRecord => ({
  prescribedIndex,
  prescribedWeightKg: null,
  prescribedReps: null,
  weightKg,
  reps,
  rir,
  rpe: rir === null ? null : 10 - rir,
  notes: '',
});

describe('sessionE1rmCandidates', () => {
  it('keeps competition-lift and extra sets with their position, and drops named variations', () => {
    const sets = [record(0, 145, 3, 1), record(1, 152.5, 2, 2), record(2, 152.5, 2, 1), record(null, 160, 1, 1)];
    expect(sessionE1rmCandidates(session(), sets)).toEqual([
      { position: 1, lift: 'deadlift', weightKg: 152.5, reps: 2, rir: 2, rpe: 8 },
      { position: 2, lift: 'deadlift', weightKg: 152.5, reps: 2, rir: 1, rpe: 9 },
      { position: 3, lift: 'deadlift', weightKg: 160, reps: 1, rir: 1, rpe: 9 },
    ]);
  });
});

describe('compareE1rm (SPEC §8.4)', () => {
  it('gives Δ kg and Δ % against the previous estimate', () => {
    // 95.6 − 92.9 = 2.7 kg; 2.7 / 92.9 = 2.906…% → 2.9 %
    expect(compareE1rm(95.6, 92.9)).toEqual({ previousKg: 92.9, deltaKg: 2.7, deltaPercent: 2.9 });
    // 92.9 − 95.6 = −2.7 kg; −2.7 / 95.6 = −2.824…% → −2.8 %
    expect(compareE1rm(92.9, 95.6)).toEqual({ previousKg: 95.6, deltaKg: -2.7, deltaPercent: -2.8 });
    expect(compareE1rm(100, 100)).toEqual({ previousKg: 100, deltaKg: 0, deltaPercent: 0 });
  });

  it('rounds Δ % to 0.1, halves away from zero', () => {
    // ±0.4 / 160 = ±0.25 % → ±0.3 %
    expect(compareE1rm(160.4, 160)).toEqual({ previousKg: 160, deltaKg: 0.4, deltaPercent: 0.3 });
    expect(compareE1rm(159.6, 160)).toEqual({ previousKg: 160, deltaKg: -0.4, deltaPercent: -0.3 });
    // 100.1 vs 80: 20.1 / 80 = 25.125 % → 25.1 %; 80.1 vs 160: −79.9/160 = −49.9375 % → −49.9 %
    expect(compareE1rm(100.1, 80)?.deltaPercent).toBe(25.1);
    expect(compareE1rm(80.1, 160)?.deltaPercent).toBe(-49.9);
  });

  it('has nothing to compare without a previous estimate', () => {
    expect(compareE1rm(95.6, null)).toBeNull();
  });
});
