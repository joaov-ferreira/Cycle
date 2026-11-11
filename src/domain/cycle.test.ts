import { DEFAULT_CYCLE, INITIAL_CYCLE_STATE } from './cycle';

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
