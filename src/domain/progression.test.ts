import { DEFAULT_CYCLE } from './cycle';
import type { Equipment } from './exercise';
import { isStalled, loadPhaseScores, suggest, type ProgressionTarget } from './progression';
import type { ExerciseSession, LoggedSet } from './workout';

const work = (weightKg: number, reps: number, rir: number | null = null): LoggedSet => ({
  kind: 'working',
  weightKg,
  reps,
  rir,
  done: true,
});
const warmup = (weightKg: number, reps: number): LoggedSet => ({
  kind: 'warmup',
  weightKg,
  reps,
  rir: null,
  done: true,
});
const notDone = (weightKg: number, reps: number): LoggedSet => ({
  kind: 'working',
  weightKg,
  reps,
  rir: null,
  done: false,
});

let nextId = 1;
const session = (sets: LoggedSet[], over: Partial<ExerciseSession> = {}): ExerciseSession => ({
  workoutId: nextId++,
  completedAt: '2026-01-01T10:00:00Z',
  phase: 'load',
  cycleNumber: 1,
  planId: 1,
  sets,
  ...over,
});
/** Working sets of one weight with the given reps. */
const at = (kg: number, ...reps: number[]): LoggedSet[] => reps.map((r) => work(kg, r));

const target: ProgressionTarget = { sets: 3, repMin: 8, repMax: 12 };

function run(
  history: ExerciseSession[],
  over: {
    target?: ProgressionTarget;
    equipment?: Equipment;
    incrementKg?: number;
    phase?: 'load' | 'deload';
  } = {},
) {
  return suggest({
    target: over.target ?? target,
    equipment: over.equipment ?? 'barbell',
    incrementKg: over.incrementKg ?? 2.5,
    phase: over.phase ?? 'load',
    cycle: DEFAULT_CYCLE,
    history,
  });
}

describe('suggest: SPEC §6.2 acceptance table', () => {
  it('40 x 12,12,12 -> increase to 42.5, reps 8,8,8', () => {
    expect(run([session(at(40, 12, 12, 12))])).toEqual({
      action: 'increase',
      reason: 'hitTopOfRange',
      loadKg: 42.5,
      sets: 3,
      targetReps: [8, 8, 8],
      lastLoadKg: 40,
      lastReps: [12, 12, 12],
      stalled: false,
    });
  });

  it('RIR 3,3,3 with targetRir 1 -> increase easy to 45', () => {
    const s = run([session([work(40, 12, 3), work(40, 12, 3), work(40, 12, 3)])], {
      target: { ...target, targetRir: 1 },
    });
    expect(s.action).toBe('increase');
    expect(s.reason).toBe('hitTopOfRangeEasy');
    expect(s.loadKg).toBe(45);
  });

  it('40 x 12,10,9 -> hold 40, reps 12,11,10', () => {
    expect(run([session(at(40, 12, 10, 9))])).toMatchObject({
      action: 'hold',
      reason: 'progressReps',
      loadKg: 40,
      targetReps: [12, 11, 10],
    });
  });

  it('40 x 8,7,6 after 40 x 9,8,7 -> hold belowRange, reps 8,8,8', () => {
    expect(run([session(at(40, 8, 7, 6)), session(at(40, 9, 8, 7))])).toMatchObject({
      action: 'hold',
      reason: 'belowRange',
      loadKg: 40,
      targetReps: [8, 8, 8],
    });
  });

  it('40 x 8,7,6 after 40 x 7,7,6 -> decrease to 35', () => {
    expect(run([session(at(40, 8, 7, 6)), session(at(40, 7, 7, 6))])).toMatchObject({
      action: 'decrease',
      reason: 'belowRangeTwice',
      loadKg: 35,
      targetReps: [8, 8, 8],
    });
  });

  it('only 2 sets logged: 40 x 12,12 -> hold, reps 12,12,8', () => {
    expect(run([session(at(40, 12, 12))])).toMatchObject({
      action: 'hold',
      loadKg: 40,
      targetReps: [12, 12, 8],
      lastReps: [12, 12],
    });
  });

  it('deload week, last work load 42.5 -> 37.5 kg, 2 sets, reps 8,8', () => {
    expect(run([session(at(42.5, 10, 10, 10))], { phase: 'deload' })).toMatchObject({
      action: 'deload',
      reason: 'deloadWeek',
      loadKg: 37.5,
      sets: 2,
      targetReps: [8, 8],
      lastLoadKg: 42.5,
    });
  });
});

describe('suggest: no history and start load', () => {
  it('noHistory', () => {
    expect(run([])).toEqual({
      action: 'start',
      reason: 'noHistory',
      loadKg: null,
      sets: 3,
      targetReps: [8, 8, 8],
      lastLoadKg: null,
      lastReps: [],
      stalled: false,
    });
  });
  it('planStartLoad', () => {
    expect(run([], { target: { ...target, startLoadKg: 20 } })).toMatchObject({
      action: 'start',
      reason: 'planStartLoad',
      loadKg: 20,
    });
  });
  it('a plan start load of 0 is honoured (zero-load equipment)', () => {
    expect(run([], { target: { ...target, startLoadKg: 0 }, equipment: 'bodyweight' }).loadKg).toBe(0);
  });
  it('history without a counted set is no history', () => {
    expect(run([session([warmup(20, 10), notDone(40, 10)])]).action).toBe('start');
  });
  it('deload without history: no load, or the deloaded start load', () => {
    expect(run([], { phase: 'deload' })).toMatchObject({
      action: 'deload',
      loadKg: null,
      sets: 2,
      targetReps: [8, 8],
    });
    expect(run([], { phase: 'deload', target: { ...target, startLoadKg: 40 } }).loadKg).toBe(35); // 36 -> 35
  });
});

describe('suggest: history filtering', () => {
  it('ignores warm-up and not-done sets', () => {
    const s = run([session([warmup(20, 12), ...at(40, 12, 12, 12), notDone(50, 12)])]);
    expect(s).toMatchObject({ action: 'increase', loadKg: 42.5, lastLoadKg: 40 });
  });
  it('ignores deload-phase sessions between load sessions', () => {
    const deload = session(at(20, 12, 12, 12), { phase: 'deload' });
    expect(run([session(at(40, 8, 7, 6)), deload, session(at(40, 7, 7, 6))]).action).toBe('decrease');
    expect(run([deload, session(at(40, 12, 12, 12))]).loadKg).toBe(42.5);
  });
  it('a newest deload session does not become last', () => {
    const s = run([session(at(10, 5, 5, 5), { phase: 'deload' }), session(at(40, 10, 10, 10))]);
    expect(s.lastLoadKg).toBe(40);
  });
});

describe('suggest: work load and set counts', () => {
  it('mixed weights: the most used weight is the work load', () => {
    const s = run([session([work(30, 12), ...at(40, 12, 12, 12)])]);
    expect(s).toMatchObject({ lastLoadKg: 40, loadKg: 42.5, action: 'increase' });
  });
  it('mixed weights tie: the heaviest', () => {
    const s = run([session([...at(40, 12, 12), ...at(30, 10, 10)])]);
    expect(s.lastLoadKg).toBe(40);
    expect(s.action).toBe('hold');
  });
  it('more sets logged than planned: all at top of range -> increase', () => {
    expect(run([session(at(40, 12, 12, 12, 12))])).toMatchObject({
      action: 'increase',
      loadKg: 42.5,
      sets: 3,
      targetReps: [8, 8, 8],
    });
  });
  it('more sets logged than planned in progressReps: targets limited to the planned sets', () => {
    const s = run([session(at(40, 12, 10, 9, 9))]);
    expect(s.targetReps).toEqual([12, 11, 10]);
    expect(s.lastReps).toEqual([12, 10, 9, 9]);
  });
  it('fewer than half below range: progress reps, lifted to repMin', () => {
    const s = run([session(at(40, 12, 12, 12, 7, 7))], { target: { ...target, sets: 5 } });
    expect(s).toMatchObject({ action: 'hold', reason: 'progressReps', targetReps: [12, 12, 12, 8, 8] });
  });
  it('fewer sets than planned is never top of range', () => {
    expect(run([session(at(40, 12, 12))]).action).toBe('hold');
  });
});

describe('suggest: exact arithmetic and increments', () => {
  it('40 + 2.5 and an off-grid 41 + 2.5', () => {
    expect(run([session(at(40, 12, 12, 12))]).loadKg).toBe(42.5);
    expect(run([session(at(41, 12, 12, 12))]).loadKg).toBe(43.5);
  });
  it('decimal loads stay exact', () => {
    expect(run([session(at(0.3, 12, 12, 12))], { incrementKg: 0.25 }).loadKg).toBe(0.55);
  });
  it('dumbbell increment 1', () => {
    const s = run([session(at(20, 12, 12, 12))], { equipment: 'dumbbell', incrementKg: 1 });
    expect(s.loadKg).toBe(21);
  });
  it('easy rule with a dumbbell: two increments', () => {
    const s = run([session([work(20, 12, 3), work(20, 12, 4), work(20, 12, 3)])], {
      equipment: 'dumbbell',
      incrementKg: 1,
    });
    expect(s).toMatchObject({ reason: 'hitTopOfRangeEasy', loadKg: 22 });
  });
});

describe('suggest: zero-load exercises', () => {
  const bw = { equipment: 'bodyweight' as const };
  it('0 kg x 12,12,12 -> increase to 2.5 kg', () => {
    expect(run([session(at(0, 12, 12, 12))], bw)).toMatchObject({
      action: 'increase',
      loadKg: 2.5,
      lastLoadKg: 0,
    });
  });
  it('never decreases below 0: holds at 0', () => {
    const s = run([session(at(0, 6, 6, 6)), session(at(0, 6, 6, 6))], bw);
    expect(s).toMatchObject({ action: 'hold', reason: 'belowRange', loadKg: 0 });
  });
  it('can decrease to 0 from one increment', () => {
    const s = run([session(at(2.5, 6, 6, 6)), session(at(2.5, 6, 6, 6))], bw);
    expect(s).toMatchObject({ action: 'decrease', loadKg: 0 });
  });
  it('deload of a zero load stays 0', () => {
    expect(run([session(at(0, 12, 12, 12))], { ...bw, phase: 'deload' }).loadKg).toBe(0);
  });
});

describe('suggest: easy rule', () => {
  const easy = (rirs: (number | null)[], targetRir?: number) =>
    run([session(rirs.map((r) => work(40, 12, r)))], { target: { ...target, targetRir } });

  it('with targetRir 2 needs min RIR 4', () => {
    expect(easy([4, 4, 5], 2).reason).toBe('hitTopOfRangeEasy');
    expect(easy([4, 3, 4], 2).reason).toBe('hitTopOfRange');
  });
  it('without targetRir uses 1: min RIR 3', () => {
    expect(easy([3, 3, 3]).loadKg).toBe(45);
    expect(easy([3, 2, 3]).loadKg).toBe(42.5);
  });
  describe('with the session target RIR (SPEC-v3 §5)', () => {
    const withSessionTarget = (rirs: number[], sessionTarget?: number | null, planTarget?: number) =>
      run([session(rirs.map((r) => work(40, 12, r)), { targetRir: sessionTarget })], {
        target: { ...target, targetRir: planTarget },
      });

    it('last session target 3: logged RIR 4 is not easy, RIR 5 is', () => {
      expect(withSessionTarget([4, 4, 4], 3).reason).toBe('hitTopOfRange');
      expect(withSessionTarget([5, 5, 5], 3).reason).toBe('hitTopOfRangeEasy');
    });
    it('the session target wins over the plan target', () => {
      expect(withSessionTarget([4, 4, 4], 3, 1).reason).toBe('hitTopOfRange');
      expect(withSessionTarget([3, 3, 3], 0, 2).reason).toBe('hitTopOfRangeEasy');
    });
    it('a session target of 0 is used (not treated as missing)', () => {
      expect(withSessionTarget([2, 2, 2], 0).reason).toBe('hitTopOfRangeEasy');
      expect(withSessionTarget([1, 1, 1], 0).reason).toBe('hitTopOfRange');
    });
    it('without a session target falls back to the plan target, then to 1', () => {
      expect(withSessionTarget([4, 4, 4], undefined, 2).reason).toBe('hitTopOfRangeEasy');
      expect(withSessionTarget([3, 3, 3], null, 2).reason).toBe('hitTopOfRange');
      expect(withSessionTarget([3, 3, 3], null).reason).toBe('hitTopOfRangeEasy');
      expect(withSessionTarget([2, 2, 2], null).reason).toBe('hitTopOfRange');
    });
  });
  it('a set with null RIR disables the easy rule', () => {
    expect(easy([3, null, 3]).reason).toBe('hitTopOfRange');
  });
  it('targetRir 0 needs min RIR 2', () => {
    expect(easy([2, 2, 2], 0).reason).toBe('hitTopOfRangeEasy');
  });
});

describe('suggest: below range', () => {
  it('a different previous work load does not decrease', () => {
    expect(run([session(at(40, 6, 6, 6)), session(at(35, 6, 6, 6))])).toMatchObject({
      action: 'hold',
      reason: 'belowRange',
    });
  });
  it('a previous session within the range does not decrease', () => {
    expect(run([session(at(40, 6, 6, 6)), session(at(40, 9, 9, 9))]).action).toBe('hold');
  });
  it('only one session: hold with repMin targets', () => {
    expect(run([session(at(40, 6, 6, 6))])).toMatchObject({
      action: 'hold',
      reason: 'belowRange',
      targetReps: [8, 8, 8],
    });
  });
  it('half of the sets below range counts', () => {
    const s = run([session(at(40, 12, 7, 7, 12)), session(at(40, 7, 7, 12, 12))], {
      target: { ...target, sets: 4 },
    });
    expect(s.action).toBe('decrease');
  });
  it('less than half below range does not', () => {
    const s = run([session(at(40, 12, 12, 7)), session(at(40, 12, 12, 7))]);
    expect(s).toMatchObject({ action: 'hold', reason: 'progressReps' });
  });
  it('decrease floor: 10 kg with increment 5 -> 5 kg', () => {
    const s = run([session(at(10, 6, 6, 6)), session(at(10, 6, 6, 6))], {
      equipment: 'machine',
      incrementKg: 5,
    });
    expect(s).toMatchObject({ action: 'decrease', loadKg: 5 });
  });
  it('5 kg with increment 5 -> hold', () => {
    const s = run([session(at(5, 6, 6, 6)), session(at(5, 6, 6, 6))], {
      equipment: 'machine',
      incrementKg: 5,
    });
    expect(s).toMatchObject({ action: 'hold', reason: 'belowRange', loadKg: 5 });
  });
  it('6 kg with increment 5 -> hold (6 - 5 = 1 is below the increment)', () => {
    const s = run([session(at(6, 6, 6, 6)), session(at(6, 6, 6, 6))], {
      equipment: 'machine',
      incrementKg: 5,
    });
    expect(s.action).toBe('hold');
  });
  it('90% not lower by one increment: load minus increment (10 kg, increment 4 -> 6)', () => {
    // 10 x 0.9 = 9 -> floor 8, only 2 lower than 10 -> 10 - 4 = 6
    const s = run([session(at(10, 6, 6, 6)), session(at(10, 6, 6, 6))], {
      equipment: 'kettlebell',
      incrementKg: 4,
    });
    expect(s).toMatchObject({ action: 'decrease', loadKg: 6 });
  });
});

describe('stall detection', () => {
  it.each([
    [[53, 53, 53], true],
    [[54, 53, 53], false],
    [[53, 54, 55], true],
    [[53, 53], false],
    [[], false],
    [[55, 54, 54], false],
    [[53, 54, 53], false],
  ])('isStalled(%j) = %p', (scores, expected) => {
    expect(isStalled(scores)).toBe(expected);
  });

  it('reason stalled in the progress rule', () => {
    const history = [
      session(at(40, 10, 10, 10)),
      session(at(40, 10, 10, 10)),
      session(at(40, 10, 10, 10)),
    ];
    expect(run(history)).toMatchObject({
      stalled: true,
      reason: 'stalled',
      action: 'hold',
      targetReps: [11, 11, 11],
    });
  });
  it('the flag also appears on other actions', () => {
    const history = [
      session(at(40, 12, 12, 12)),
      session(at(40, 12, 12, 12)),
      session(at(40, 12, 12, 12)),
    ];
    expect(run(history)).toMatchObject({ action: 'increase', reason: 'hitTopOfRange', stalled: true });
  });
  it('is not stalled when improving', () => {
    const history = [
      session(at(40, 12, 10, 9)),
      session(at(40, 10, 9, 8)),
      session(at(40, 9, 8, 7)),
    ];
    expect(run(history).stalled).toBe(false);
  });
});

describe('loadPhaseScores', () => {
  const s1 = session(at(40, 10, 10, 10), { planId: 1, cycleNumber: 2 }); // 40 x (1 + 10/30) = 53.333
  const s2 = session(at(30, 10), { planId: 2, cycleNumber: 2 }); // 30 x 4/3 = 40
  const s3 = session(at(60, 5), { planId: 1, cycleNumber: 1 }); // 60 x (1 + 5/30) = 70
  const deload = session(at(99, 5), { phase: 'deload' });
  const empty = session([warmup(20, 10)]);
  const all = [s1, deload, empty, s2, s3];

  it('scores load sessions with counted sets, newest first', () => {
    expect(loadPhaseScores(all)).toEqual([53.333, 40, 70]);
  });
  it('filters by plan and cycle', () => {
    expect(loadPhaseScores(all, { planId: 1 })).toEqual([53.333, 70]);
    expect(loadPhaseScores(all, { cycleNumber: 2 })).toEqual([53.333, 40]);
    expect(loadPhaseScores(all, { planId: 1, cycleNumber: 2 })).toEqual([53.333]);
  });
  it('uses mean reps for zero-load sessions', () => {
    expect(loadPhaseScores([session(at(0, 12, 10, 8))])).toEqual([10]);
  });
});
