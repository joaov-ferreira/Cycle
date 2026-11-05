import {
  compareWithEquivalent,
  entryE1rm,
  entryTonnageKg,
  equivalentSessions,
  filterHistory,
  groupActualSets,
  groupPrescribedSets,
  historyPrograms,
  sortHistory,
  type HistoryEntry,
} from './history';
import type { SetRecord } from './performance';

const set = (overrides: Partial<SetRecord> = {}): SetRecord => ({
  prescribedIndex: 0,
  prescribedWeightKg: 75,
  prescribedReps: 5,
  weightKg: 75,
  reps: 5,
  rir: 2,
  rpe: 8,
  notes: '',
  ...overrides,
});

let nextId = 1;
const entry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: nextId++,
  lift: 'bench',
  templateId: 'cycle-531-custom',
  templateName: '5/3/1 (custom)',
  templateVersion: '1.0',
  programDay: 1,
  periodizationId: 1,
  sessionNumber: 1,
  blockWeek: 1,
  completedAt: '2026-11-09T18:00:00.000Z',
  editedAt: null,
  notes: '',
  sets: [set(), set(), set()],
  e1rms: [],
  ...overrides,
});

const ids = (entries: readonly HistoryEntry[]) => entries.map((e) => e.id);

describe('sortHistory', () => {
  it('lists the newest completion first, equal dates by the latest record', () => {
    const a = entry({ completedAt: '2026-11-02T10:00:00.000Z' });
    const b = entry({ completedAt: '2026-11-16T10:00:00.000Z' });
    const c = entry({ completedAt: '2026-11-09T10:00:00.000Z' });
    const d = entry({ completedAt: '2026-11-09T10:00:00.000Z' });
    expect(ids(sortHistory([a, b, c, d]))).toEqual([b.id, d.id, c.id, a.id]);
  });

  it('does not change the input', () => {
    const items = [entry({ completedAt: '2026-11-02T10:00:00.000Z' }), entry({ completedAt: '2026-11-16T10:00:00.000Z' })];
    const copy = [...items];
    sortHistory(items);
    expect(items).toEqual(copy);
  });

  it('compares instants, not text (offsets)', () => {
    const early = entry({ completedAt: '2026-11-09T23:30:00.000-03:00' }); // 02:30Z on the 10th
    const late = entry({ completedAt: '2026-11-10T01:00:00.000Z' });
    expect(ids(sortHistory([early, late]))).toEqual([early.id, late.id]);
  });
});

describe('filterHistory', () => {
  const now = new Date('2026-12-15T12:00:00.000Z');
  const bench = entry({ lift: 'bench', completedAt: '2026-12-10T10:00:00.000Z' });
  const squat531 = entry({ lift: 'squat', completedAt: '2026-11-20T10:00:00.000Z' });
  const squatSmolov = entry({
    lift: 'squat',
    templateId: 'smolov',
    templateName: 'Smolov',
    completedAt: '2026-09-01T10:00:00.000Z',
  });
  const deadliftOld = entry({ lift: 'deadlift', templateId: 'sheiko-29', completedAt: '2025-12-14T10:00:00.000Z' });
  const all = [squatSmolov, bench, deadliftOld, squat531];

  it('returns everything, newest first, without filters', () => {
    expect(ids(filterHistory(all, {}, now))).toEqual([bench.id, squat531.id, squatSmolov.id, deadliftOld.id]);
    expect(ids(filterHistory(all, { period: 'all' }, now))).toEqual([bench.id, squat531.id, squatSmolov.id, deadliftOld.id]);
  });

  it('filters by lift', () => {
    expect(ids(filterHistory(all, { lift: 'squat' }, now))).toEqual([squat531.id, squatSmolov.id]);
    expect(ids(filterHistory(all, { lift: 'deadlift' }, now))).toEqual([deadliftOld.id]);
  });

  it('filters by program (template id)', () => {
    expect(ids(filterHistory(all, { templateId: 'smolov' }, now))).toEqual([squatSmolov.id]);
    expect(ids(filterHistory(all, { templateId: 'cycle-531-custom' }, now))).toEqual([bench.id, squat531.id]);
    expect(filterHistory(all, { templateId: 'sheiko-30' }, now)).toEqual([]);
  });

  it('filters by period counted back from now: 4 weeks = 28 days, then calendar months', () => {
    // 4w: from 2026-11-17T12:00Z
    expect(ids(filterHistory(all, { period: '4w' }, now))).toEqual([bench.id, squat531.id]);
    // 3m: from 2026-09-15 -> the Smolov session (09-01) is out
    expect(ids(filterHistory(all, { period: '3m' }, now))).toEqual([bench.id, squat531.id]);
    // 6m: from 2026-06-15
    expect(ids(filterHistory(all, { period: '6m' }, now))).toEqual([bench.id, squat531.id, squatSmolov.id]);
    // 1y: from 2025-12-15T12:00Z -> the 2025-12-14 session is out
    expect(ids(filterHistory(all, { period: '1y' }, now))).toEqual([bench.id, squat531.id, squatSmolov.id]);
  });

  it('includes a session completed exactly at the start of the period', () => {
    const edge = entry({ completedAt: '2026-11-17T12:00:00.000Z' });
    const before = entry({ completedAt: '2026-11-17T11:59:59.999Z' });
    expect(ids(filterHistory([before, edge], { period: '4w' }, now))).toEqual([edge.id]);
  });

  it('combines the filters', () => {
    expect(ids(filterHistory(all, { lift: 'squat', templateId: 'cycle-531-custom', period: '4w' }, now))).toEqual([
      squat531.id,
    ]);
    expect(filterHistory(all, { lift: 'bench', templateId: 'smolov' }, now)).toEqual([]);
  });
});

describe('historyPrograms', () => {
  it('lists each program once, by name, with the name of its latest session', () => {
    const entries = [
      entry({ templateId: 'smolov', templateName: 'Smolov (old name)', completedAt: '2026-01-01T00:00:00.000Z' }),
      entry({ templateId: 'smolov', templateName: 'Smolov', completedAt: '2026-02-01T00:00:00.000Z' }),
      entry({ templateId: 'cycle-531-custom', templateName: '5/3/1 (custom)' }),
    ];
    expect(historyPrograms(entries)).toEqual([
      { templateId: 'cycle-531-custom', templateName: '5/3/1 (custom)' },
      { templateId: 'smolov', templateName: 'Smolov' },
    ]);
    expect(historyPrograms([])).toEqual([]);
  });
});

describe('entry figures', () => {
  it('tonnage is Σ reps × weight of the performed sets, extra sets included (3 × 75×5 + 80×3 = 1365)', () => {
    const e = entry({ sets: [set(), set(), set(), set({ prescribedIndex: null, weightKg: 80, reps: 3 })] });
    expect(entryTonnageKg(e)).toBe(1365);
  });

  it('is exact on decimal loads (3 × 82.5 × 3 = 742.5)', () => {
    expect(entryTonnageKg(entry({ sets: [set({ weightKg: 82.5, reps: 3 }), set({ weightKg: 82.5, reps: 3 }), set({ weightKg: 82.5, reps: 3 })] }))).toBe(742.5);
  });

  it("the entry's e1RM is the stored estimate of its own lift, or null", () => {
    const e = entry({
      lift: 'squat',
      e1rms: [
        { lift: 'bench', valueKg: 100.4, formula: 'rts', setPosition: 0 },
        { lift: 'squat', valueKg: 150.2, formula: 'rts', setPosition: 1 },
      ],
    });
    expect(entryE1rm(e)).toEqual({ lift: 'squat', valueKg: 150.2, formula: 'rts', setPosition: 1 });
    expect(entryE1rm(entry())).toBeNull();
  });
});

describe('equivalentSessions', () => {
  const base = { lift: 'bench' as const, templateId: 'cycle-531-custom', programDay: 1 };
  const target = entry({ ...base, completedAt: '2026-11-23T10:00:00.000Z' });
  const w3 = entry({ ...base, completedAt: '2026-11-16T10:00:00.000Z' });
  const w2 = entry({ ...base, completedAt: '2026-11-09T10:00:00.000Z' });
  const w1 = entry({ ...base, completedAt: '2026-11-02T10:00:00.000Z' });
  const w0 = entry({ ...base, completedAt: '2026-10-26T10:00:00.000Z' });
  const otherLift = entry({ ...base, lift: 'squat', completedAt: '2026-11-10T10:00:00.000Z' });
  const otherProgram = entry({ ...base, templateId: 'smolov-jr', completedAt: '2026-11-10T10:00:00.000Z' });
  const otherDay = entry({ ...base, programDay: 2, completedAt: '2026-11-10T10:00:00.000Z' });
  const later = entry({ ...base, completedAt: '2026-11-30T10:00:00.000Z' });
  const everything = [later, w0, otherLift, target, w2, otherProgram, w3, otherDay, w1];

  it('are earlier sessions of the same lift, program and program day, newest first', () => {
    expect(ids(equivalentSessions(target, everything, 10))).toEqual([w3.id, w2.id, w1.id, w0.id]);
  });

  it('keeps the most recent ones up to the limit (default 3)', () => {
    expect(ids(equivalentSessions(target, everything))).toEqual([w3.id, w2.id, w1.id]);
    expect(ids(equivalentSessions(target, everything, 1))).toEqual([w3.id]);
  });

  it('does not depend on the block week: the same program day of another week or cycle counts', () => {
    const otherCycleWeek3 = entry({ ...base, blockWeek: 3, completedAt: '2026-11-20T10:00:00.000Z' });
    expect(ids(equivalentSessions(target, [otherCycleWeek3], 3))).toEqual([otherCycleWeek3.id]);
  });

  it('does not include the session itself, nor later sessions, and an equal date counts only when recorded earlier', () => {
    const sameInstantEarlier = entry({ ...base, completedAt: '2026-11-23T10:00:00.000Z' });
    const sameInstantLater = entry({ ...base, completedAt: '2026-11-23T10:00:00.000Z' });
    const t = sameInstantEarlier;
    expect(ids(equivalentSessions(t, [t, sameInstantLater], 3))).toEqual([]);
    expect(ids(equivalentSessions(sameInstantLater, [t, sameInstantLater], 3))).toEqual([t.id]);
  });

  it('has none when the program day is unknown', () => {
    const unknown = entry({ ...base, programDay: null, completedAt: '2026-11-23T10:00:00.000Z' });
    const earlier = entry({ ...base, programDay: null, completedAt: '2026-11-01T10:00:00.000Z' });
    expect(equivalentSessions(unknown, [unknown, earlier])).toEqual([]);
  });
});

describe('compareWithEquivalent', () => {
  const current = entry({
    sets: [set({ weightKg: 80, reps: 5 }), set({ weightKg: 80, reps: 5 }), set({ weightKg: 80, reps: 5 })], // 1200
    e1rms: [{ lift: 'bench', valueKg: 95.6, formula: 'rts', setPosition: 2 }],
  });
  const previous = entry({
    sets: [set(), set(), set()], // 1125
    e1rms: [{ lift: 'bench', valueKg: 92.9, formula: 'brzycki-rir', setPosition: 2 }],
  });

  it('gives Δ tonnage and Δ e1RM (95.6 - 92.9 = +2.7 kg, +2.9 %)', () => {
    expect(compareWithEquivalent(current, previous)).toEqual({
      deltaTonnageKg: 75,
      e1rm: { previousKg: 92.9, deltaKg: 2.7, deltaPercent: 2.9 },
    });
  });

  it('has no e1RM comparison unless both sessions have an estimate', () => {
    expect(compareWithEquivalent(current, { ...previous, e1rms: [] }).e1rm).toBeNull();
    expect(compareWithEquivalent({ ...current, e1rms: [] }, previous).e1rm).toBeNull();
  });

  it('is negative when the earlier session was heavier', () => {
    expect(compareWithEquivalent(previous, current)).toEqual({
      deltaTonnageKg: -75,
      e1rm: { previousKg: 95.6, deltaKg: -2.7, deltaPercent: -2.8 },
    });
  });
});

describe('set grouping for summaries', () => {
  it('groups consecutive prescribed sets with the same reps and load (3×5 @ 75, 1×3 @ 85)', () => {
    const sets = [
      set(),
      set({ prescribedIndex: 1 }),
      set({ prescribedIndex: 2 }),
      set({ prescribedIndex: 3, prescribedReps: 3, prescribedWeightKg: 85 }),
      set({ prescribedIndex: null, prescribedWeightKg: null, prescribedReps: null }),
    ];
    expect(groupPrescribedSets(sets)).toEqual([
      { count: 3, reps: 5, weightKg: 75 },
      { count: 1, reps: 3, weightKg: 85 },
    ]);
  });

  it('keeps sets without a load and does not merge across a change', () => {
    const sets = [
      set({ prescribedWeightKg: null }),
      set({ prescribedWeightKg: null, prescribedIndex: 1 }),
      set({ prescribedIndex: 2 }),
      set({ prescribedIndex: 3, prescribedReps: 5, prescribedWeightKg: null }),
    ];
    expect(groupPrescribedSets(sets)).toEqual([
      { count: 2, reps: 5, weightKg: null },
      { count: 1, reps: 5, weightKg: 75 },
      { count: 1, reps: 5, weightKg: null },
    ]);
  });

  it('has no prescription for a session of extra sets only', () => {
    expect(groupPrescribedSets([set({ prescribedIndex: null, prescribedWeightKg: null, prescribedReps: null })])).toEqual([]);
    expect(groupPrescribedSets([])).toEqual([]);
  });

  it('groups consecutive performed sets with the same weight, reps, RIR and RPE', () => {
    const sets = [
      set(),
      set(),
      set({ weightKg: 80, reps: 5, rir: 1, rpe: 9 }),
      set({ weightKg: 80, reps: 5, rir: 1, rpe: 9, prescribedIndex: null }),
      set({ weightKg: 80, reps: 5, rir: null, rpe: null }),
      set({ weightKg: 75 }),
    ];
    expect(groupActualSets(sets)).toEqual([
      { count: 2, weightKg: 75, reps: 5, rir: 2, rpe: 8 },
      { count: 2, weightKg: 80, reps: 5, rir: 1, rpe: 9 },
      { count: 1, weightKg: 80, reps: 5, rir: null, rpe: null },
      { count: 1, weightKg: 75, reps: 5, rir: 2, rpe: 8 },
    ]);
  });

  it('skips sets without weight or reps', () => {
    expect(groupActualSets([set({ weightKg: null }), set({ reps: null })])).toEqual([]);
  });
});
