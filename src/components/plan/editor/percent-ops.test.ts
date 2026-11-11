import type { PercentProgression } from '@/domain/percent-scheme';
import type { PlanExercise } from '@/domain/plan';

import {
  addGroup,
  addWeek,
  copyPreviousWeek,
  removeGroup,
  removeWeek,
  setBasis,
  setStartWeek,
  toAutomatic,
  toPercent,
  updateGroup,
  withScheme,
} from './percent-ops';

const base: PlanExercise = {
  id: 'e1',
  exerciseId: 'barbell-bench-press',
  sets: 4,
  repMin: 6,
  repMax: 10,
  targetRir: 2,
  startLoadKg: 60,
  restSeconds: 120,
  note: 'pause',
};

const scheme = (...weeks: PercentProgression['weeks'][number]['sets'][]): PercentProgression => ({
  weeks: weeks.map((sets) => ({ sets })),
});

describe('toPercent', () => {
  it('starts a scheme from the exercise targets and drops RIR and the start load', () => {
    const next = toPercent(base);
    expect(next.percent).toEqual({ weeks: [{ sets: [{ reps: 6, percent: 70, repeat: 4 }] }] });
    expect(next).not.toHaveProperty('targetRir');
    expect(next).not.toHaveProperty('startLoadKg');
    expect(next).toMatchObject({ restSeconds: 120, note: 'pause', sets: 4, repMin: 6, repMax: 6 });
  });

  it('writes a single set without repeat', () => {
    expect(toPercent({ ...base, sets: 1 }).percent?.weeks[0].sets[0]).toEqual({ reps: 6, percent: 70 });
  });
});

describe('toAutomatic', () => {
  it('removes the scheme and keeps the summary as the automatic targets', () => {
    const percent = toPercent({ ...base, sets: 5, repMin: 5 });
    const next = toAutomatic(percent);
    expect(next).not.toHaveProperty('percent');
    expect(next).toMatchObject({ sets: 5, repMin: 5, repMax: 5, restSeconds: 120 });
    expect(next).not.toHaveProperty('targetRir');
    expect(next).not.toHaveProperty('startLoadKg');
  });

  it('keeps the targets within the automatic limits', () => {
    const wide = withScheme(base, scheme([{ reps: 3, percent: 80, repeat: 20 }, { reps: 12, percent: 60, repeat: 20 }]));
    expect(toAutomatic(wide).sets).toBe(20);
  });
});

describe('withScheme', () => {
  it('rewrites sets and reps from the first non-empty week', () => {
    const next = withScheme(base, scheme([], [{ reps: 5, percent: 75, repeat: 3 }, { reps: 3, percent: 85 }]));
    expect(next).toMatchObject({ sets: 4, repMin: 3, repMax: 5 });
  });

  it('leaves the summary alone when every week is empty', () => {
    expect(withScheme(base, scheme([]))).toMatchObject({ sets: 4, repMin: 6, repMax: 10 });
  });
});

describe('weeks', () => {
  it('adds an empty week up to 16', () => {
    expect(addWeek(scheme([{ reps: 5 }])).weeks).toEqual([{ sets: [{ reps: 5 }] }, { sets: [] }]);
    const full = { weeks: Array.from({ length: 16 }, () => ({ sets: [] })) };
    expect(addWeek(full).weeks).toHaveLength(16);
  });

  it('removes a week but never the last one, and keeps the start week inside', () => {
    const three = { ...scheme([{ reps: 1 }], [{ reps: 2 }], [{ reps: 3 }]), startWeek: 3 };
    const two = removeWeek(three, 0);
    expect(two.weeks.map((w) => w.sets[0].reps)).toEqual([2, 3]);
    expect(two.startWeek).toBe(2);
    const one = removeWeek(two, 1);
    expect(one.startWeek).toBeUndefined();
    expect(removeWeek(one, 0).weeks).toHaveLength(1);
  });

  it('copies the previous week into a week, replacing its groups', () => {
    const base2 = scheme([{ reps: 5, percent: 70 }], [{ reps: 1 }]);
    const copied = copyPreviousWeek(base2, 1);
    expect(copied.weeks[1].sets).toEqual([{ reps: 5, percent: 70 }]);
    copied.weeks[1].sets[0].reps = 99;
    expect(copied.weeks[0].sets[0].reps).toBe(5);
    expect(copyPreviousWeek(base2, 0)).toEqual(base2);
  });
});

describe('groups', () => {
  it('adds a group like the last one of the week, or a default one', () => {
    expect(addGroup(scheme([{ reps: 3, percent: 85, repeat: 2, amrap: true }]), 0).weeks[0].sets[1]).toEqual({
      reps: 3,
      percent: 85,
    });
    expect(addGroup(scheme([]), 0).weeks[0].sets).toEqual([{ reps: 5, percent: 70 }]);
  });

  it('does not add past 20 groups', () => {
    const full = scheme(Array.from({ length: 20 }, () => ({ reps: 1 })));
    expect(addGroup(full, 0).weeks[0].sets).toHaveLength(20);
  });

  it('updates a group and drops cleared optional fields', () => {
    const start = scheme([{ reps: 5, percent: 70, addKg: 2.5, repeat: 3, amrap: true }]);
    const next = updateGroup(start, 0, 0, { percent: undefined, addKg: undefined, repeat: 1, amrap: false });
    expect(next.weeks[0].sets[0]).toEqual({ reps: 5 });
    expect(updateGroup(start, 0, 0, { reps: 8 }).weeks[0].sets[0]).toMatchObject({ reps: 8, percent: 70 });
  });

  it('removes a group, leaving the week empty when it was the last', () => {
    const start = scheme([{ reps: 5 }, { reps: 3 }]);
    expect(removeGroup(start, 0, 0).weeks[0].sets).toEqual([{ reps: 3 }]);
    expect(removeGroup(removeGroup(start, 0, 0), 0, 0).weeks[0].sets).toEqual([]);
  });
});

describe('start week and basis', () => {
  it('stores the start week only when it is not 1', () => {
    expect(setStartWeek(scheme([], []), 2).startWeek).toBe(2);
    expect(setStartWeek({ ...scheme([], []), startWeek: 2 }, 1)).not.toHaveProperty('startWeek');
  });

  it('stores the basis exercise, or removes it', () => {
    expect(setBasis(scheme([]), 'barbell-back-squat').basisExerciseId).toBe('barbell-back-squat');
    expect(setBasis({ ...scheme([]), basisExerciseId: 'x' }, undefined)).not.toHaveProperty('basisExerciseId');
  });
});
