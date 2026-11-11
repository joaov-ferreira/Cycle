import {
  clampCycleState,
  completeSession,
  cycleTimeline,
  deloadAdvice,
  deloadLoad,
  deloadSets,
  startDeload,
  startNewCycle,
  suggestCycle,
  type CycleConfig,
  type CycleState,
  DEFAULT_CYCLE,
  DEFAULT_EXPERIENCE,
  EXPERIENCE_LEVELS,
  INITIAL_CYCLE_STATE,
  isExperience,
} from './cycle';

describe('experience levels (SPEC §5.1)', () => {
  it('lists beginner, intermediate and advanced, defaulting to intermediate', () => {
    expect(EXPERIENCE_LEVELS).toEqual(['beginner', 'intermediate', 'advanced']);
    expect(DEFAULT_EXPERIENCE).toBe('intermediate');
  });

  it.each(EXPERIENCE_LEVELS.map((value) => [value]))('isExperience accepts %p', (value) => {
    expect(isExperience(value)).toBe(true);
  });

  it.each([['Beginner'], ['novice'], [''], [null], [undefined], [1]])(
    'isExperience rejects %p',
    (value) => {
      expect(isExperience(value)).toBe(false);
    },
  );
});

describe('INITIAL_CYCLE_STATE (SPEC §5.2)', () => {
  it('starts at cycle 1, load week 1, nothing done, first workout', () => {
    expect(INITIAL_CYCLE_STATE).toEqual({
      cycleNumber: 1,
      phase: 'load',
      week: 1,
      sessionsDoneThisWeek: 0,
      nextWorkoutIndex: 0,
    });
  });
});

describe('DEFAULT_CYCLE (SPEC §3.1)', () => {
  it('is 6 load weeks, 1 deload week, deload at 50 % volume and 90 % load', () => {
    expect(DEFAULT_CYCLE).toEqual({
      loadWeeks: 6,
      deloadWeeks: 1,
      deloadVolumeFactor: 0.5,
      deloadLoadFactor: 0.9,
    });
  });
});

const cfg = (over: Partial<CycleConfig> = {}): CycleConfig => ({ ...DEFAULT_CYCLE, ...over });
const st = (over: Partial<CycleState> = {}): CycleState => ({ ...INITIAL_CYCLE_STATE, ...over });
const wk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `w${i}`, name: `W${i}`, exercises: [] }));
const plan = (workouts: number, sessionsPerWeek: number, cycle: CycleConfig) => ({
  workouts: wk(workouts),
  sessionsPerWeek,
  cycle,
});

function run(p: ReturnType<typeof plan>, sessions: number): CycleState {
  let state = INITIAL_CYCLE_STATE;
  for (let i = 0; i < sessions; i++) state = completeSession(p, state, state.nextWorkoutIndex);
  return state;
}

describe('suggestCycle (SPEC §5.1)', () => {
  it.each([
    ['beginner', 8],
    ['intermediate', 6],
    ['advanced', 4],
  ] as const)('%s', (experience, loadWeeks) => {
    expect(suggestCycle(experience)).toEqual({
      loadWeeks,
      deloadWeeks: 1,
      deloadVolumeFactor: 0.5,
      deloadLoadFactor: 0.9,
    });
  });
});

describe('completeSession (SPEC §5.2)', () => {
  const p = plan(3, 3, cfg({ loadWeeks: 4, deloadWeeks: 1 }));

  it('acceptance: 11, 12 and 15 sessions', () => {
    expect(run(p, 11)).toEqual({ cycleNumber: 1, phase: 'load', week: 4, sessionsDoneThisWeek: 2, nextWorkoutIndex: 2 });
    expect(run(p, 12)).toEqual({ cycleNumber: 1, phase: 'deload', week: 1, sessionsDoneThisWeek: 0, nextWorkoutIndex: 0 });
    expect(run(p, 15)).toEqual({ cycleNumber: 2, phase: 'load', week: 1, sessionsDoneThisWeek: 0, nextWorkoutIndex: 0 });
  });

  it('uses the finished workout index, not the suggested one', () => {
    expect(completeSession(p, INITIAL_CYCLE_STATE, 2)).toEqual(
      st({ sessionsDoneThisWeek: 1, nextWorkoutIndex: 0 }),
    );
  });

  it('deloadWeeks 0: the next cycle starts right after the load weeks', () => {
    const q = plan(3, 3, cfg({ loadWeeks: 4, deloadWeeks: 0 }));
    expect(run(q, 12)).toEqual(st({ cycleNumber: 2 }));
  });

  it('deloadWeeks 2: deload lasts two weeks', () => {
    const q = plan(3, 3, cfg({ loadWeeks: 4, deloadWeeks: 2 }));
    expect(run(q, 15)).toEqual(st({ phase: 'deload', week: 2 }));
    expect(run(q, 18)).toEqual(st({ cycleNumber: 2 }));
  });

  it('sessionsPerWeek larger than the workouts: A B C A B C is one week', () => {
    const q = plan(3, 6, cfg({ loadWeeks: 2, deloadWeeks: 1 }));
    expect(run(q, 5)).toEqual(st({ sessionsDoneThisWeek: 5, nextWorkoutIndex: 2 }));
    expect(run(q, 6)).toEqual(st({ week: 2, nextWorkoutIndex: 0 }));
  });

  it('a manual deload with deloadWeeks 0 lasts one week then starts a new cycle', () => {
    const q = plan(2, 2, cfg({ loadWeeks: 4, deloadWeeks: 0 }));
    let state = startDeload(st({ nextWorkoutIndex: 1 }));
    state = completeSession(q, state, 1);
    expect(state).toEqual(st({ phase: 'deload', sessionsDoneThisWeek: 1, nextWorkoutIndex: 0 }));
    state = completeSession(q, state, 0);
    expect(state).toEqual(st({ cycleNumber: 2, nextWorkoutIndex: 1 }));
  });

  it('a load week beyond a shortened loadWeeks ends at the week boundary', () => {
    const q = plan(1, 1, cfg({ loadWeeks: 2, deloadWeeks: 1 }));
    expect(completeSession(q, st({ week: 5 }), 0)).toEqual(st({ phase: 'deload', week: 1 }));
  });

  it('a deload week beyond a shortened deloadWeeks ends the cycle', () => {
    const q = plan(1, 1, cfg({ deloadWeeks: 1 }));
    expect(completeSession(q, st({ phase: 'deload', week: 2 }), 0)).toEqual(st({ cycleNumber: 2 }));
  });
});

describe('manual actions', () => {
  it('startDeload keeps cycle number and next workout, resets week and counter', () => {
    expect(startDeload(st({ cycleNumber: 3, week: 4, sessionsDoneThisWeek: 2, nextWorkoutIndex: 1 }))).toEqual({
      cycleNumber: 3,
      phase: 'deload',
      week: 1,
      sessionsDoneThisWeek: 0,
      nextWorkoutIndex: 1,
    });
  });

  it('startNewCycle increments the cycle and keeps the next workout', () => {
    expect(
      startNewCycle(st({ cycleNumber: 3, phase: 'deload', week: 1, sessionsDoneThisWeek: 2, nextWorkoutIndex: 1 })),
    ).toEqual({ cycleNumber: 4, phase: 'load', week: 1, sessionsDoneThisWeek: 0, nextWorkoutIndex: 1 });
  });
});

describe('clampCycleState', () => {
  it('keeps a valid state', () => {
    const s = st({ nextWorkoutIndex: 1, sessionsDoneThisWeek: 2 });
    expect(clampCycleState(s, 3, 3)).toEqual(s);
  });
  it('resets an out-of-range workout index', () => {
    expect(clampCycleState(st({ nextWorkoutIndex: 3 }), 3, 3).nextWorkoutIndex).toBe(0);
    expect(clampCycleState(st({ nextWorkoutIndex: -1 }), 3, 3).nextWorkoutIndex).toBe(0);
  });
  it('caps the sessions done at sessionsPerWeek - 1', () => {
    expect(clampCycleState(st({ sessionsDoneThisWeek: 4 }), 3, 2).sessionsDoneThisWeek).toBe(1);
    expect(clampCycleState(st({ sessionsDoneThisWeek: 0 }), 3, 1).sessionsDoneThisWeek).toBe(0);
  });
});

describe('deloadSets (SPEC §5.3)', () => {
  it.each([
    [4, 0.5, 2],
    [3, 0.5, 2],
    [5, 0.5, 3],
    [3, 0.7, 3],
    [10, 0.3, 3],
    [1, 0.3, 1],
    [4, 1, 4],
    [20, 0.35, 7],
  ])('%i sets x %f -> %i', (sets, factor, expected) => {
    expect(deloadSets(sets, factor)).toBe(expected);
  });
});

describe('deloadLoad (SPEC §5.3)', () => {
  it.each([
    [42.5, 0.9, 2.5, 37.5],
    [100, 0.9, 2.5, 90],
    [60, 0.5, 2.5, 30],
    [20, 0.95, 1, 19],
    [0, 0.9, 2.5, 0],
    [41, 0.9, 2.5, 37.5],
  ])('%f x %f (inc %f) -> %f', (load, factor, inc, expected) => {
    expect(deloadLoad(load, factor, inc)).toBe(expected);
  });
});

describe('cycleTimeline', () => {
  const cells = (c: CycleConfig, s: CycleState) => cycleTimeline(c, s).map((x) => `${x.phase[0]}${x.week}${x.current ? '*' : ''}`);

  it('load cells then deload cells, current marked', () => {
    expect(cells(cfg({ loadWeeks: 3, deloadWeeks: 1 }), st({ week: 2 }))).toEqual(['l1', 'l2*', 'l3', 'd1']);
  });
  it('marks the deload cell', () => {
    expect(cells(cfg({ loadWeeks: 2, deloadWeeks: 2 }), st({ phase: 'deload', week: 2 }))).toEqual(['l1', 'l2', 'd1', 'd2*']);
  });
  it('appends an unscheduled manual deload cell', () => {
    expect(cells(cfg({ loadWeeks: 2, deloadWeeks: 0 }), st({ phase: 'deload' }))).toEqual(['l1', 'l2', 'd1*']);
  });
  it('has no deload cell when deloadWeeks is 0 in the load phase', () => {
    expect(cells(cfg({ loadWeeks: 2, deloadWeeks: 0 }), st())).toEqual(['l1*', 'l2']);
  });
  it('a load week beyond loadWeeks marks the last load cell', () => {
    expect(cells(cfg({ loadWeeks: 2, deloadWeeks: 1 }), st({ week: 5 }))).toEqual(['l1', 'l2*', 'd1']);
  });
  it('a deload week beyond the scheduled ones stays in range', () => {
    expect(cells(cfg({ loadWeeks: 1, deloadWeeks: 1 }), st({ phase: 'deload', week: 3 }))).toEqual(['l1', 'd1', 'd2', 'd3*']);
  });
});

describe('deloadAdvice (SPEC §5.4)', () => {
  const c = cfg({ loadWeeks: 4, deloadWeeks: 1 });
  const stalled = [50, 50, 50];
  const improving = [53, 52, 51];
  const ex = (id: string, scores: number[]) => ({ exerciseId: id, scores });

  it('inDeload', () => {
    expect(deloadAdvice({ cycle: c, state: st({ phase: 'deload' }), exercises: [ex('a', stalled), ex('b', stalled)] })).toEqual({ kind: 'inDeload' });
  });
  it('none', () => {
    expect(deloadAdvice({ cycle: c, state: st({ week: 2 }), exercises: [ex('a', improving)] })).toEqual({ kind: 'none' });
  });
  it('upcoming at the last load week', () => {
    expect(deloadAdvice({ cycle: c, state: st({ week: 4 }), exercises: [] })).toEqual({ kind: 'upcoming' });
    expect(deloadAdvice({ cycle: c, state: st({ week: 6 }), exercises: [] })).toEqual({ kind: 'upcoming' });
  });
  it('no upcoming without a scheduled deload', () => {
    expect(deloadAdvice({ cycle: cfg({ loadWeeks: 4, deloadWeeks: 0 }), state: st({ week: 4 }), exercises: [] })).toEqual({ kind: 'none' });
  });
  it('early carries the stalled ids and wins over upcoming', () => {
    expect(
      deloadAdvice({ cycle: c, state: st({ week: 4 }), exercises: [ex('a', stalled), ex('b', stalled), ex('c', improving)] }),
    ).toEqual({ kind: 'early', stalledExerciseIds: ['a', 'b'] });
  });
  it.each([
    ['2 of 4 tracked -> early', 2, 4, true],
    ['1 of 2 tracked -> none', 1, 2, false],
    ['2 of 5 tracked -> none', 2, 5, false],
    ['3 of 5 tracked -> early', 3, 5, true],
  ])('threshold: %s', (_n, stalledCount, tracked, early) => {
    const exercises = Array.from({ length: tracked }, (_, i) => ex(`e${i}`, i < stalledCount ? stalled : improving));
    const advice = deloadAdvice({ cycle: c, state: st({ week: 1 }), exercises });
    expect(advice.kind).toBe(early ? 'early' : 'none');
  });
  it('exercises with fewer than 3 scores are not tracked', () => {
    const exercises = [ex('a', stalled), ex('b', stalled), ex('c', [1]), ex('d', [1, 1]), ex('e', []), ex('f', [5, 4, 3])];
    expect(deloadAdvice({ cycle: c, state: st(), exercises })).toEqual({ kind: 'early', stalledExerciseIds: ['a', 'b'] });
  });
});
