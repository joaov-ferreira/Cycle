import type { GeneratedSession } from './periodization';
import {
  MAX_NOTES_LENGTH,
  buildPerformanceSnapshot,
  compareSession,
  compareSet,
  hasErrors,
  parseSessionId,
  pendingSessions,
  prescribedSets,
  snapshotSessionId,
  validatePerformedSession,
  validateSetEntry,
  type SetRecord,
} from './performance';

function session(overrides: Partial<GeneratedSession> = {}): GeneratedSession {
  const week = overrides.blockWeek ?? 1;
  const n = overrides.sessionNumber ?? 1;
  return {
    key: `${n}-w${week}`,
    slotId: n,
    sessionNumber: n,
    blockWeek: week,
    programWeek: week,
    lift: 'bench',
    templateId: 'cycle-531-custom',
    templateName: '5/3/1 (custom)',
    templateVersion: 'v',
    verification: 'verified',
    programDay: 1,
    daysPerWeek: 1,
    items: [
      {
        kind: 'main',
        lift: 'bench',
        sets: [{ sets: 3, reps: 5, percent: 0.75, addKg: null, amrap: false, exactKg: 75, roundedKg: 75, load: 'calculated' }],
      },
    ],
    otherItems: [],
    volume: { tonnageKg: 1125, totalReps: 15 },
    volumeByLift: { bench: { tonnageKg: 1125, totalReps: 15 } },
    warnings: [],
    ...overrides,
  };
}

describe('prescribedSets', () => {
  it('expands repeated sets one by one, in order, with the rounded load', () => {
    expect(prescribedSets(session())).toEqual([
      { index: 0, itemIndex: 0, lift: 'bench', reps: 5, weightKg: 75, percent: 0.75, amrap: false },
      { index: 1, itemIndex: 0, lift: 'bench', reps: 5, weightKg: 75, percent: 0.75, amrap: false },
      { index: 2, itemIndex: 0, lift: 'bench', reps: 5, weightKg: 75, percent: 0.75, amrap: false },
    ]);
  });

  it('keeps sets without a load (weight null), variation names, and skips accessories, info and other lifts', () => {
    const exercise = { en: 'Deadlift from boxes' };
    const s = session({
      lift: 'deadlift',
      items: [
        {
          kind: 'main',
          lift: 'deadlift',
          exercise,
          sets: [
            { sets: 1, reps: 3, percent: 0.9, addKg: null, amrap: true, exactKg: 162, roundedKg: 162.5, load: 'calculated' },
            { sets: 2, reps: 2, percent: null, addKg: null, amrap: false, exactKg: null, roundedKg: null, load: 'unverified' },
          ],
        },
        { kind: 'accessory', name: { en: 'Abs' }, text: { en: '5 × 10' } },
        { kind: 'info', text: { en: 'Rest' } },
      ],
      otherItems: [{ kind: 'main', lift: 'bench', sets: [{ reps: 5, percent: 0.7 }] }],
    });
    expect(prescribedSets(s)).toEqual([
      { index: 0, itemIndex: 0, lift: 'deadlift', exercise, reps: 3, weightKg: 162.5, percent: 0.9, amrap: true },
      { index: 1, itemIndex: 0, lift: 'deadlift', exercise, reps: 2, weightKg: null, percent: null, amrap: false },
      { index: 2, itemIndex: 0, lift: 'deadlift', exercise, reps: 2, weightKg: null, percent: null, amrap: false },
    ]);
  });

  it('is empty for a session without calculated work', () => {
    expect(prescribedSets(session({ items: [{ kind: 'info', text: { en: 'Rest' } }] }))).toEqual([]);
  });
});

describe('validateSetEntry', () => {
  const ok = { weightKg: 80, reps: 5, rir: 1, rpe: 9, notes: '' };

  it('accepts a complete valid set', () => {
    expect(validateSetEntry(ok, { complete: true })).toEqual({});
    expect(validateSetEntry({ ...ok, rir: null, rpe: null }, { complete: true })).toEqual({});
  });

  it('requires weight and reps to complete, but not in a draft', () => {
    const empty = { weightKg: null, reps: null, rir: null, rpe: null, notes: '' };
    expect(validateSetEntry(empty, { complete: true })).toEqual({ weight: 'required', reps: 'required' });
    expect(validateSetEntry(empty, { complete: false })).toEqual({});
  });

  it.each([
    [0, 'notAboveMin'],
    [-5, 'notAboveMin'],
    [1000.5, 'aboveMax'],
    [80.125, 'tooManyDecimals'],
    [Number.NaN, 'invalidNumber'],
  ])('rejects weight %p as %p', (weightKg, code) => {
    expect(validateSetEntry({ ...ok, weightKg }, { complete: false })).toEqual({ weight: code });
  });

  it.each([0.5, 82.5, 1000])('accepts weight %p', (weightKg) => {
    expect(validateSetEntry({ ...ok, weightKg }, { complete: true })).toEqual({});
  });

  it('accepts 0 reps (failure) and up to 100', () => {
    expect(validateSetEntry({ ...ok, reps: 0 }, { complete: true })).toEqual({});
    expect(validateSetEntry({ ...ok, reps: 100 }, { complete: true })).toEqual({});
  });

  it.each([-1, 1.5, 101, Number.NaN])('rejects reps %p', (reps) => {
    expect(validateSetEntry({ ...ok, reps }, { complete: true })).toEqual({ reps: 'invalidReps' });
  });

  it('validates RIR (0–10) and RPE (1–10, half steps)', () => {
    expect(validateSetEntry({ ...ok, rir: 11, rpe: null }, { complete: true })).toEqual({ rir: 'invalidRir' });
    expect(validateSetEntry({ ...ok, rir: null, rpe: 0 }, { complete: true })).toEqual({ rpe: 'invalidRpe' });
    expect(validateSetEntry({ ...ok, rir: null, rpe: 8.25 }, { complete: true })).toEqual({ rpe: 'invalidRpe' });
    expect(validateSetEntry({ ...ok, rir: 1.5, rpe: 8.5 }, { complete: true })).toEqual({});
  });

  it('reports a RIR/RPE divergence above 0.5 on the RPE field', () => {
    expect(validateSetEntry({ ...ok, rir: 1, rpe: 8 }, { complete: true })).toEqual({ rpe: 'rirRpeMismatch' });
    expect(validateSetEntry({ ...ok, rir: 1, rpe: 8.5 }, { complete: true })).toEqual({});
  });

  it(`limits notes to ${MAX_NOTES_LENGTH} characters`, () => {
    expect(validateSetEntry({ ...ok, notes: 'x'.repeat(500) }, { complete: true })).toEqual({});
    expect(validateSetEntry({ ...ok, notes: 'x'.repeat(501) }, { complete: true })).toEqual({ notes: 'tooLong' });
  });
});

describe('validatePerformedSession', () => {
  const set = { weightKg: 80, reps: 5, rir: null, rpe: null, notes: '' };

  it('needs at least one set to complete', () => {
    const result = validatePerformedSession({ sets: [], notes: '' }, { complete: true });
    expect(result).toEqual({ sets: [], session: 'noSets' });
    expect(hasErrors(result)).toBe(true);
    expect(hasErrors(validatePerformedSession({ sets: [], notes: '' }, { complete: false }))).toBe(false);
  });

  it('collects the errors of every set by position and the session notes', () => {
    const result = validatePerformedSession(
      { sets: [set, { ...set, weightKg: null }, { ...set, reps: -1 }], notes: 'y'.repeat(501) },
      { complete: true },
    );
    expect(result).toEqual({ sets: [{}, { weight: 'required' }, { reps: 'invalidReps' }], notes: 'tooLong' });
    expect(hasErrors(result)).toBe(true);
  });

  it('is clean for valid input', () => {
    const result = validatePerformedSession({ sets: [set, set], notes: 'felt good' }, { complete: true });
    expect(result).toEqual({ sets: [{}, {}] });
    expect(hasErrors(result)).toBe(false);
  });
});

describe('prescribed vs. actual', () => {
  it('compares a set: Δ kg and Δ reps', () => {
    expect(compareSet({ weightKg: 75, reps: 5 }, { weightKg: 80, reps: 5 })).toEqual({ deltaKg: 5, deltaReps: 0 });
    expect(compareSet({ weightKg: 75, reps: 5 }, { weightKg: 72.5, reps: 7 })).toEqual({ deltaKg: -2.5, deltaReps: 2 });
    expect(compareSet({ weightKg: 0.3, reps: 1 }, { weightKg: 0.1, reps: 0 })).toEqual({ deltaKg: -0.2, deltaReps: -1 });
  });

  it('has no Δ for an extra set, a missing load or an unfilled field', () => {
    expect(compareSet(null, { weightKg: 80, reps: 5 })).toEqual({ deltaKg: null, deltaReps: null });
    expect(compareSet({ weightKg: null, reps: 5 }, { weightKg: 80, reps: 4 })).toEqual({ deltaKg: null, deltaReps: -1 });
    expect(compareSet({ weightKg: 75, reps: 5 }, { weightKg: null, reps: null })).toEqual({ deltaKg: null, deltaReps: null });
  });

  const rec = (
    prescribedIndex: number | null,
    prescribedWeightKg: number | null,
    prescribedReps: number | null,
    weightKg: number | null,
    reps: number | null,
  ): SetRecord => ({ prescribedIndex, prescribedWeightKg, prescribedReps, weightKg, reps, rir: null, rpe: null, notes: '' });

  it('compares tonnage: prescribed sets vs. everything performed, extra sets included', () => {
    const result = compareSession([
      rec(0, 75, 5, 80, 5), // 375 → 400
      rec(1, 75, 5, 80, 4), // 375 → 320
      rec(2, 75, 5, 77.5, 5), // 375 → 387.5
      rec(null, null, null, 60, 10), // extra: 600
    ]);
    expect(result).toEqual({ prescribedTonnageKg: 1125, actualTonnageKg: 1707.5, deltaTonnageKg: 582.5 });
  });

  it('ignores sets that lack a weight or reps, and prescribed sets without a load', () => {
    const result = compareSession([
      rec(0, 75, 5, null, null),
      rec(1, null, 3, 100, 3), // prescription without a load: only the actual counts
      rec(2, 75, 5, 75, 5),
    ]);
    expect(result).toEqual({ prescribedTonnageKg: 750, actualTonnageKg: 675, deltaTonnageKg: -75 });
  });

  it('adds without floating-point error', () => {
    const result = compareSession([rec(0, 0.1, 3, 0.2, 3), rec(1, 0.1, 3, 0.2, 3), rec(2, 0.1, 3, 0.2, 3)]);
    expect(result).toEqual({ prescribedTonnageKg: 0.9, actualTonnageKg: 1.8, deltaTonnageKg: 0.9 });
  });
});

describe('snapshot session ids', () => {
  it('builds and parses ids that point at an activated snapshot', () => {
    expect(snapshotSessionId(12, '3-w2')).toBe('p12-3-w2');
    expect(parseSessionId('p12-3-w2')).toEqual({ periodizationId: 12, key: '3-w2' });
  });

  it('leaves live keys alone', () => {
    expect(parseSessionId('3-w2')).toEqual({ periodizationId: null, key: '3-w2' });
    expect(parseSessionId('')).toEqual({ periodizationId: null, key: '' });
    expect(parseSessionId('nonsense')).toEqual({ periodizationId: null, key: 'nonsense' });
    expect(parseSessionId('p-3-w2')).toEqual({ periodizationId: null, key: 'p-3-w2' });
  });
});

describe('pendingSessions', () => {
  const a = session({ blockWeek: 1, sessionNumber: 1 });
  const b = session({ blockWeek: 1, sessionNumber: 2 });
  const c = session({ blockWeek: 2, sessionNumber: 1 });
  const rest = session({ blockWeek: 2, sessionNumber: 2, items: [{ kind: 'info', text: { en: 'Rest' } }] });

  it('lists sessions with work and no record, by week then session number', () => {
    expect(pendingSessions([c, rest, b, a], []).map((s) => s.key)).toEqual(['1-w1', '2-w1', '1-w2']);
  });

  it('drops sessions that were started or completed', () => {
    expect(pendingSessions([a, b, c], ['1-w1', '1-w2']).map((s) => s.key)).toEqual(['2-w1']);
    expect(pendingSessions([a], ['1-w1'])).toEqual([]);
  });
});

describe('buildPerformanceSnapshot', () => {
  it('freezes the prescription with the 1RM and rounding in effect at activation', () => {
    const s = session();
    const periodization = {
      id: 7,
      startDate: '2026-11-09',
      config: {
        oneRms: { bench: 100, squat: 140 },
        rounding: { incrementKg: 2.5, mode: 'nearest' as const, liftIncrementsKg: { bench: 1.25 } },
      },
    };
    expect(buildPerformanceSnapshot(periodization, s)).toEqual({
      periodizationId: 7,
      startDate: '2026-11-09',
      oneRmKg: 100,
      incrementKg: 1.25,
      roundingMode: 'nearest',
      session: s,
    });
  });

  it('uses the default increment and a null 1RM when the lift has none', () => {
    const s = session({ lift: 'squat' });
    const snapshot = buildPerformanceSnapshot(
      {
        id: 1,
        startDate: '2026-11-09',
        config: { oneRms: { bench: 100 }, rounding: { incrementKg: 2.5, mode: 'down', liftIncrementsKg: {} } },
      },
      s,
    );
    expect(snapshot.oneRmKg).toBeNull();
    expect(snapshot.incrementKg).toBe(2.5);
    expect(snapshot.roundingMode).toBe('down');
  });

  it('does not alias the session it is given', () => {
    const s = session();
    const snapshot = buildPerformanceSnapshot(
      { id: 1, startDate: '2026-11-09', config: { oneRms: { bench: 100 }, rounding: { incrementKg: 2.5, mode: 'nearest', liftIncrementsKg: {} } } },
      s,
    );
    s.volume.totalReps = 999;
    expect(snapshot.session.volume.totalReps).toBe(15);
  });
});
