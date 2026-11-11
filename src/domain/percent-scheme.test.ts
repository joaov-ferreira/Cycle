import {
  SCHEME_LIMITS,
  deloadSchemeSets,
  flattenSchemeSets,
  programWeekFor,
  schemeSummary,
  schemeWeekFor,
  validatePercentProgression,
  withPercentSummary,
  type PercentProgression,
} from './percent-scheme';
import type { SchemeSet } from './scheme-set';

const exists = () => true;
const issues = (p: unknown, exerciseExists: (id: string) => boolean = exists) =>
  validatePercentProgression(p as PercentProgression, { exerciseExists });

const good: PercentProgression = {
  weeks: [{ sets: [{ reps: 5, percent: 75, repeat: 3 }] }, { sets: [{ reps: 3, percent: 85, repeat: 3 }] }],
};

describe('programWeekFor', () => {
  it.each([
    [1, 1, 3, 1],
    [1, 4, 3, 1],
    [4, 2, 13, 5],
    [12, 3, 13, 1],
  ])('(%i, %i, %i) -> %i', (start, cycle, length, expected) => {
    expect(programWeekFor(start, cycle, length)).toBe(expected);
  });
});

describe('SCHEME_LIMITS', () => {
  it('holds the limits of SPEC-v4 §5.1', () => {
    expect(SCHEME_LIMITS).toEqual({
      weeks: { min: 1, max: 16 },
      groupsPerWeek: { max: 20 },
      setsPerWeek: { max: 40 },
      reps: { min: 1, max: 100 },
      percent: { min: 1, max: 120, step: 0.5 },
      addKg: { min: -100, max: 100, maxDecimals: 2 },
      repeat: { min: 1, max: 20 },
    });
  });
});

describe('validatePercentProgression', () => {
  it('accepts a valid progression', () => {
    expect(issues(good)).toEqual([]);
    expect(
      issues({ ...good, startWeek: 2, basisExerciseId: 'squat' }),
    ).toEqual([]);
  });

  it('accepts the boundary values', () => {
    expect(
      issues({
        weeks: [
          { sets: [{ reps: 1, percent: 1 }, { reps: 100, percent: 120, addKg: -100, repeat: 20 }] },
          { sets: [{ reps: 2, percent: 0.5 + 0.5, addKg: 100, repeat: 1 }] },
        ],
      }),
    ).toEqual([]);
  });

  it('requires weeks', () => {
    expect(issues({})).toEqual([{ path: 'weeks', code: 'required' }]);
    expect(issues({ weeks: 'x' })).toEqual([{ path: 'weeks', code: 'required' }]);
  });

  it('rejects too few and too many weeks', () => {
    expect(issues({ weeks: [] })).toEqual([{ path: 'weeks', code: 'tooFew' }]);
    const weeks = Array.from({ length: 17 }, () => ({ sets: [{ reps: 5, percent: 70 }] }));
    expect(issues({ weeks })).toEqual([{ path: 'weeks', code: 'tooMany' }]);
    expect(issues({ weeks: weeks.slice(0, 16) })).toEqual([]);
  });

  it('flags a week that is not an object or has no sets array', () => {
    expect(issues({ weeks: [{ sets: [{ reps: 5, percent: 70 }] }, {}] })).toEqual([
      { path: 'weeks[1].sets', code: 'required' },
    ]);
  });

  it('limits groups and expanded sets per week', () => {
    const group = { reps: 5, percent: 70 };
    expect(issues({ weeks: [{ sets: Array.from({ length: 21 }, () => group) }] })).toEqual([
      { path: 'weeks[0].sets', code: 'tooMany' },
    ]);
    expect(issues({ weeks: [{ sets: Array.from({ length: 20 }, () => ({ ...group, repeat: 2 })) }] })).toEqual([]);
    expect(
      issues({ weeks: [{ sets: [{ ...group, repeat: 20 }, { ...group, repeat: 20 }, { ...group, repeat: 1 }] }] }),
    ).toEqual([{ path: 'weeks[0].sets', code: 'tooMany' }]);
  });

  it('validates reps', () => {
    const one = (set: object) => issues({ weeks: [{ sets: [set] }] });
    expect(one({ percent: 70 })).toEqual([{ path: 'weeks[0].sets[0].reps', code: 'required' }]);
    expect(one({ reps: 0, percent: 70 })).toEqual([{ path: 'weeks[0].sets[0].reps', code: 'outOfRange' }]);
    expect(one({ reps: 101, percent: 70 })).toEqual([{ path: 'weeks[0].sets[0].reps', code: 'outOfRange' }]);
    expect(one({ reps: 2.5, percent: 70 })).toEqual([{ path: 'weeks[0].sets[0].reps', code: 'notInteger' }]);
  });

  it('validates percent', () => {
    const one = (percent: unknown) => issues({ weeks: [{ sets: [{ reps: 5, percent }] }] });
    expect(one(0.5)).toEqual([{ path: 'weeks[0].sets[0].percent', code: 'outOfRange' }]);
    expect(one(120.5)).toEqual([{ path: 'weeks[0].sets[0].percent', code: 'outOfRange' }]);
    expect(one(72.3)).toEqual([{ path: 'weeks[0].sets[0].percent', code: 'invalidStep' }]);
    expect(one(72.25)).toEqual([{ path: 'weeks[0].sets[0].percent', code: 'invalidStep' }]);
    expect(one(72.5)).toEqual([]);
    expect(one(undefined)).toEqual([]);
  });

  it('validates addKg', () => {
    const one = (addKg: unknown) => issues({ weeks: [{ sets: [{ reps: 5, percent: 70, addKg }] }] });
    expect(one(-100.5)).toEqual([{ path: 'weeks[0].sets[0].addKg', code: 'outOfRange' }]);
    expect(one(100.01)).toEqual([{ path: 'weeks[0].sets[0].addKg', code: 'outOfRange' }]);
    expect(one(2.505)).toEqual([{ path: 'weeks[0].sets[0].addKg', code: 'tooManyDecimals' }]);
    expect(one(2.55)).toEqual([]);
  });

  it('validates repeat', () => {
    const one = (repeat: unknown) => issues({ weeks: [{ sets: [{ reps: 5, percent: 70, repeat }] }] });
    expect(one(0)).toEqual([{ path: 'weeks[0].sets[0].repeat', code: 'outOfRange' }]);
    expect(one(21)).toEqual([{ path: 'weeks[0].sets[0].repeat', code: 'outOfRange' }]);
    expect(one(1.5)).toEqual([{ path: 'weeks[0].sets[0].repeat', code: 'notInteger' }]);
  });

  it('validates startWeek', () => {
    expect(issues({ ...good, startWeek: 0 })).toEqual([{ path: 'startWeek', code: 'outOfRange' }]);
    expect(issues({ ...good, startWeek: 3 })).toEqual([{ path: 'startWeek', code: 'outOfRange' }]);
    expect(issues({ ...good, startWeek: 1.5 })).toEqual([{ path: 'startWeek', code: 'notInteger' }]);
    expect(issues({ ...good, startWeek: 2 })).toEqual([]);
  });

  it('validates the basis exercise', () => {
    const known = (id: string) => id === 'squat';
    expect(issues({ ...good, basisExerciseId: 'ghost' }, known)).toEqual([
      { path: 'basisExerciseId', code: 'unknownExercise' },
    ]);
    expect(issues({ ...good, basisExerciseId: 'squat' }, known)).toEqual([]);
  });

  it('flags a scheme whose every week is empty', () => {
    expect(issues({ weeks: [{ sets: [] }, { sets: [] }] })).toEqual([{ path: 'weeks', code: 'emptyScheme' }]);
    expect(issues({ weeks: [{ sets: [] }, { sets: [{ reps: 5, percent: 70 }] }] })).toEqual([]);
  });

  it('collects several issues in order', () => {
    expect(
      issues({ weeks: [{ sets: [{ reps: 0, percent: 130 }] }], startWeek: 5 }),
    ).toEqual([
      { path: 'weeks[0].sets[0].reps', code: 'outOfRange' },
      { path: 'weeks[0].sets[0].percent', code: 'outOfRange' },
      { path: 'startWeek', code: 'outOfRange' },
    ]);
  });
});

describe('flattenSchemeSets', () => {
  it('expands repeat and defaults it to 1', () => {
    const sets: SchemeSet[] = [{ reps: 5, percent: 70, repeat: 2 }, { reps: 3, percent: 80 }];
    expect(flattenSchemeSets(sets)).toEqual([
      { reps: 5, percent: 70, repeat: 1 },
      { reps: 5, percent: 70, repeat: 1 },
      { reps: 3, percent: 80, repeat: 1 },
    ]);
  });
  it('returns an empty list for no sets', () => {
    expect(flattenSchemeSets([])).toEqual([]);
  });
});

describe('schemeWeekFor', () => {
  const p: PercentProgression = {
    weeks: [{ sets: [{ reps: 5 }] }, { sets: [{ reps: 3 }] }, { sets: [{ reps: 1 }] }],
    startWeek: 2,
  };
  it('resolves the 1-based scheme week from the cycle week', () => {
    expect(schemeWeekFor(p, 1)).toEqual({ week: 2, sets: [{ reps: 3 }] });
    expect(schemeWeekFor(p, 2)).toEqual({ week: 3, sets: [{ reps: 1 }] });
    expect(schemeWeekFor(p, 3)).toEqual({ week: 1, sets: [{ reps: 5 }] });
  });
  it('defaults startWeek to 1 and repeats a short scheme', () => {
    expect(schemeWeekFor({ weeks: p.weeks }, 4).week).toBe(1);
  });
});

describe('schemeSummary', () => {
  it('summarises the first non-empty week', () => {
    const p: PercentProgression = {
      weeks: [
        { sets: [] },
        { sets: [{ reps: 5, repeat: 3 }, { reps: 3 }, { reps: 8, repeat: 2 }] },
        { sets: [{ reps: 1 }] },
      ],
    };
    expect(schemeSummary(p)).toEqual({ sets: 6, repMin: 3, repMax: 8 });
  });
  it('is null when every week is empty', () => {
    expect(schemeSummary({ weeks: [{ sets: [] }] })).toBeNull();
  });
});

describe('withPercentSummary', () => {
  const base = { id: 'x', sets: 3, repMin: 8, repMax: 12 };
  it('writes the summary into a copy', () => {
    const e = { ...base, percent: { weeks: [{ sets: [{ reps: 5, repeat: 3 }, { reps: 3 }] }] } };
    const out = withPercentSummary(e);
    expect(out).toEqual({ ...e, sets: 4, repMin: 3, repMax: 5 });
    expect(out).not.toBe(e);
    expect(e.sets).toBe(3);
  });
  it('is unchanged without percent or with an all-empty scheme', () => {
    expect(withPercentSummary(base)).toEqual(base);
    const empty = { ...base, percent: { weeks: [{ sets: [] }] } };
    expect(withPercentSummary(empty)).toEqual(empty);
  });
});

describe('deloadSchemeSets', () => {
  it('keeps ceil(repeat × factor) sets per group and removes amrap', () => {
    const sets: SchemeSet[] = [
      { reps: 5, percent: 75, repeat: 3 },
      { reps: 3, percent: 85, repeat: 4, amrap: true },
      { reps: 1, percent: 95 },
    ];
    expect(deloadSchemeSets(sets, 0.5)).toEqual([
      { reps: 5, percent: 75, repeat: 2 },
      { reps: 3, percent: 85, repeat: 2, amrap: false },
      { reps: 1, percent: 95, repeat: 1 },
    ]);
  });
  it('keeps at least one set', () => {
    expect(deloadSchemeSets([{ reps: 5, repeat: 2 }], 0.3)).toEqual([{ reps: 5, repeat: 1 }]);
  });
});
