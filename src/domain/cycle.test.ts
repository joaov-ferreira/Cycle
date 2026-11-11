import {
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
