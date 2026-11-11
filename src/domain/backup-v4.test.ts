/** Backup additions of v4 (SPEC-v4 §11.2): reference maxes, percent schemes, program blocks, prescriptions. */
import {
  backupSummary,
  buildBackup,
  parseBackup,
  referencedCustomExerciseIds,
  remapBackup,
  serializeBackup,
  type BackupData,
  type BackupDocument,
} from './backup';
import type { Prescription } from './prescription';

const META = { exportedAt: '2026-12-01T10:00:00.000Z', appVersion: '4.0.0' };

const prescription = (basisExerciseId: string): Prescription => ({
  basisExerciseId,
  basisKg: 140,
  sets: [
    { reps: 5, amrap: false, unverified: false, percent: 75, addKg: 0, exactKg: 105, kg: 105 },
    { reps: 8, amrap: true, unverified: true, percent: null, addKg: 2.5, exactKg: null, kg: null },
  ],
  source: {
    kind: 'program',
    programId: 'smolov-jr',
    programWeek: 2,
    day: 1,
    label: { en: 'Heavy', 'pt-BR': 'Pesado' },
  },
  phase: 'load',
  warnings: ['unverified', 'noPercent'],
});

function v4Data(): BackupData {
  return {
    profileName: 'Rafael',
    settings: {
      language: 'en',
      focus: 'strength',
      e1rmFormula: 'rts',
      effortScale: 'rpe',
      roundingMode: 'up',
    },
    customExercises: [
      {
        id: 'custom-3',
        name: 'Box squat',
        primaryMuscle: 'quads',
        secondaryMuscles: [],
        equipment: 'barbell',
        mechanics: 'compound',
        archived: false,
      },
      {
        id: 'custom-5',
        name: 'Pin press',
        primaryMuscle: 'chest',
        secondaryMuscles: [],
        equipment: 'barbell',
        mechanics: 'compound',
        archived: false,
      },
    ],
    exerciseSettings: [],
    referenceMaxes: [
      { exerciseId: 'barbell-bench-press', kg: 100, effectiveAt: '2026-01-10T10:00:00.000Z', origin: 'manual' },
      { exerciseId: 'barbell-bench-press', kg: 102.5, effectiveAt: '2026-02-10T10:00:00.000Z', origin: 'fromE1rm' },
      { exerciseId: 'custom-3', kg: 120, effectiveAt: '2026-01-10T10:00:00.000Z', origin: 'onboarding' },
      { exerciseId: 'conventional-deadlift', kg: 180, effectiveAt: '2025-12-01T10:00:00.000Z', origin: 'v1' },
      { exerciseId: 'barbell-back-squat', kg: 140, effectiveAt: '2026-03-01T10:00:00.000Z', origin: 'import' },
    ],
    plans: [
      {
        id: 7,
        active: true,
        content: {
          name: 'Strength',
          description: '',
          sessionsPerWeek: 2,
          cycle: { loadWeeks: 4, deloadWeeks: 0, deloadVolumeFactor: 0.6, deloadLoadFactor: 0.9 },
          workouts: [
            {
              id: 'w1',
              name: 'Squat',
              exercises: [
                {
                  id: 'p1',
                  exerciseId: 'barbell-back-squat',
                  sets: 5,
                  repMin: 3,
                  repMax: 5,
                  percent: {
                    weeks: [
                      { sets: [{ reps: 5, percent: 75, repeat: 3 }, { reps: 3, percent: 87.5, addKg: -5, amrap: true, unverified: true }] },
                      { sets: [] },
                    ],
                    startWeek: 2,
                    basisExerciseId: 'custom-3',
                  },
                },
                { id: 'p2', exerciseId: 'seated-cable-row', sets: 3, repMin: 8, repMax: 12 },
              ],
              programs: [
                {
                  id: 'pg1',
                  programId: 'smolov-jr',
                  day: 2,
                  startWeek: 3,
                  roles: { lift: 'custom-3' },
                  accessories: true,
                  params: { increment: 2.5 },
                },
                { id: 'pg2', programId: 'sheiko', day: 1, startWeek: 1, roles: { squat: 'barbell-back-squat', bench: 'custom-5' }, accessories: false },
              ],
            },
            {
              id: 'w2',
              name: 'Only program',
              exercises: [],
              programs: [{ id: 'pg3', programId: '531-custom', day: 1, startWeek: 1, roles: { lift: 'custom-5' }, accessories: false }],
            },
          ],
        },
        cycleState: { cycleNumber: 1, phase: 'load', week: 1, sessionsDoneThisWeek: 0, nextWorkoutIndex: 0 },
        createdAt: '2026-01-01T08:00:00.000Z',
        updatedAt: '2026-02-01T08:00:00.000Z',
        archivedAt: null,
      },
    ],
    workouts: [
      {
        id: 20,
        planId: 7,
        planWorkoutId: 'w1',
        name: 'Squat',
        status: 'completed',
        phase: 'load',
        cycleNumber: 1,
        cycleWeek: 1,
        startedAt: '2026-03-01T09:00:00.000Z',
        completedAt: '2026-03-01T10:00:00.000Z',
        notes: '',
        exercises: [
          {
            exerciseId: 'barbell-back-squat',
            planExerciseId: 'p1:0',
            target: null,
            supersetGroup: null,
            note: '',
            prescription: prescription('custom-3'),
            sets: [
              { kind: 'working', weightKg: 105, reps: 5, rir: 1.5, done: true },
              { kind: 'working', weightKg: 117.5, reps: 3, rir: 0.5, done: true },
            ],
          },
          { exerciseId: 'seated-cable-row', planExerciseId: 'p2', target: null, supersetGroup: null, note: '', sets: [] },
        ],
      },
    ],
    bodyMetrics: [],
  };
}

const build = (): BackupDocument => buildBackup(v4Data(), META);

function parseMutated(mutate: (doc: any) => void) {
  const doc = JSON.parse(serializeBackup(build()));
  mutate(doc);
  return parseBackup(JSON.stringify(doc));
}

describe('backup v4: building and parsing keep every new field', () => {
  it('builds the referenceMaxes section and keeps the settings', () => {
    const doc = build();
    expect(doc.version).toBe(1);
    expect(doc.referenceMaxes).toHaveLength(5);
    expect(doc.settings).toMatchObject({ focus: 'strength', e1rmFormula: 'rts', effortScale: 'rpe', roundingMode: 'up' });
  });

  it('round-trips the whole document through JSON', () => {
    const doc = build();
    expect(parseBackup(serializeBackup(doc))).toEqual({ ok: true, backup: doc });
  });

  it('keeps reference maxes in order, with every field', () => {
    const result = parseBackup(serializeBackup(build()));
    expect(result.ok && result.backup.referenceMaxes).toEqual(v4Data().referenceMaxes);
  });

  it('keeps percent schemes (weeks, empty weeks, startWeek, basis, every set field)', () => {
    const result = parseBackup(serializeBackup(build()));
    if (!result.ok) throw new Error('must parse');
    expect(result.backup.plans[0].content.workouts[0].exercises[0].percent).toEqual(
      v4Data().plans[0].content.workouts[0].exercises[0].percent,
    );
    expect(result.backup.plans[0].content.workouts[0].exercises[1]).not.toHaveProperty('percent');
  });

  it('keeps program blocks in order with roles and params, and workouts without own exercises', () => {
    const result = parseBackup(serializeBackup(build()));
    if (!result.ok) throw new Error('must parse');
    const workouts = result.backup.plans[0].content.workouts;
    expect(workouts[0].programs).toEqual(v4Data().plans[0].content.workouts[0].programs);
    expect(workouts[1].exercises).toEqual([]);
    expect(workouts[1].programs).toHaveLength(1);
    expect(workouts[0].programs?.[1]).not.toHaveProperty('params');
  });

  it('keeps prescription snapshots (source label included), planExerciseId and half-point RIR', () => {
    const result = parseBackup(serializeBackup(build()));
    if (!result.ok) throw new Error('must parse');
    const [first, second] = result.backup.workouts[0].exercises;
    expect(first.prescription).toEqual(prescription('custom-3'));
    expect(first.planExerciseId).toBe('p1:0');
    expect(first.sets.map((s) => s.rir)).toEqual([1.5, 0.5]);
    expect(second).not.toHaveProperty('prescription');
  });

  it('keeps a scheme prescription source and a null basis', () => {
    const doc = build();
    doc.workouts[0].exercises[0].prescription = {
      ...prescription('custom-3'),
      basisKg: null,
      source: { kind: 'scheme', schemeWeek: 4 },
      warnings: ['missingReferenceMax'],
    };
    expect(parseBackup(serializeBackup(doc))).toEqual({ ok: true, backup: doc });
  });

  it('treats a null prescription as absent', () => {
    const result = parseMutated((d) => (d.workouts[0].exercises[0].prescription = null));
    expect(result.ok && result.backup.workouts[0].exercises[0]).not.toHaveProperty('prescription');
  });
});

describe('backup v4: a v3 document still parses, without the new parts', () => {
  it('defaults the missing referenceMaxes section to an empty list', () => {
    const result = parseMutated((d) => {
      delete d.referenceMaxes;
      for (const key of ['focus', 'e1rmFormula', 'effortScale', 'roundingMode']) delete d.settings[key];
      delete d.plans[0].content.workouts[0].programs;
      d.plans[0].content.workouts.splice(1, 1);
      delete d.plans[0].content.workouts[0].exercises[0].percent;
      delete d.workouts[0].exercises[0].prescription;
    });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.backup.referenceMaxes).toEqual([]);
    expect(result.backup.settings).toEqual({ language: 'en' });
    expect(result.backup.plans[0].content.workouts[0]).not.toHaveProperty('programs');
  });
});

describe('backup v4: errors use the existing code and a path', () => {
  it.each([
    ['referenceMaxes not an array', (d: any) => (d.referenceMaxes = {}), 'referenceMaxes'],
    ['reference max item', (d: any) => (d.referenceMaxes[0] = 5), 'referenceMaxes[0]'],
    ['reference max exercise', (d: any) => (d.referenceMaxes[1].exerciseId = ''), 'referenceMaxes[1].exerciseId'],
    ['reference max kg type', (d: any) => (d.referenceMaxes[1].kg = '100'), 'referenceMaxes[1].kg'],
    ['reference max kg zero', (d: any) => (d.referenceMaxes[1].kg = 0), 'referenceMaxes[1].kg'],
    ['reference max kg too high', (d: any) => (d.referenceMaxes[1].kg = 1000.5), 'referenceMaxes[1].kg'],
    ['reference max kg decimals', (d: any) => (d.referenceMaxes[1].kg = 100.123), 'referenceMaxes[1].kg'],
    ['reference max date', (d: any) => (d.referenceMaxes[2].effectiveAt = 'soon'), 'referenceMaxes[2].effectiveAt'],
    ['reference max origin', (d: any) => (d.referenceMaxes[2].origin = 'guess'), 'referenceMaxes[2].origin'],
    ['percent not an object', (d: any) => (d.plans[0].content.workouts[0].exercises[0].percent = 3), 'plans[0].content.workouts[0].exercises[0].percent'],
    ['percent weeks', (d: any) => (d.plans[0].content.workouts[0].exercises[0].percent.weeks = {}), 'plans[0].content.workouts[0].exercises[0].percent.weeks'],
    ['percent week sets', (d: any) => (d.plans[0].content.workouts[0].exercises[0].percent.weeks[1].sets = null), 'plans[0].content.workouts[0].exercises[0].percent.weeks[1].sets'],
    ['percent set reps', (d: any) => (d.plans[0].content.workouts[0].exercises[0].percent.weeks[0].sets[0].reps = 'a'), 'plans[0].content.workouts[0].exercises[0].percent.weeks[0].sets[0].reps'],
    ['percent set percent', (d: any) => (d.plans[0].content.workouts[0].exercises[0].percent.weeks[0].sets[0].percent = 'a'), 'plans[0].content.workouts[0].exercises[0].percent.weeks[0].sets[0].percent'],
    ['percent set addKg', (d: any) => (d.plans[0].content.workouts[0].exercises[0].percent.weeks[0].sets[1].addKg = 'a'), 'plans[0].content.workouts[0].exercises[0].percent.weeks[0].sets[1].addKg'],
    ['percent set repeat', (d: any) => (d.plans[0].content.workouts[0].exercises[0].percent.weeks[0].sets[0].repeat = 'a'), 'plans[0].content.workouts[0].exercises[0].percent.weeks[0].sets[0].repeat'],
    ['percent set amrap', (d: any) => (d.plans[0].content.workouts[0].exercises[0].percent.weeks[0].sets[1].amrap = 1), 'plans[0].content.workouts[0].exercises[0].percent.weeks[0].sets[1].amrap'],
    ['percent set unverified', (d: any) => (d.plans[0].content.workouts[0].exercises[0].percent.weeks[0].sets[1].unverified = 'x'), 'plans[0].content.workouts[0].exercises[0].percent.weeks[0].sets[1].unverified'],
    ['percent startWeek', (d: any) => (d.plans[0].content.workouts[0].exercises[0].percent.startWeek = 'a'), 'plans[0].content.workouts[0].exercises[0].percent.startWeek'],
    ['percent basis', (d: any) => (d.plans[0].content.workouts[0].exercises[0].percent.basisExerciseId = 4), 'plans[0].content.workouts[0].exercises[0].percent.basisExerciseId'],
    ['programs not an array', (d: any) => (d.plans[0].content.workouts[0].programs = {}), 'plans[0].content.workouts[0].programs'],
    ['program id', (d: any) => (d.plans[0].content.workouts[0].programs[0].id = ''), 'plans[0].content.workouts[0].programs[0].id'],
    ['program programId', (d: any) => delete d.plans[0].content.workouts[0].programs[1].programId, 'plans[0].content.workouts[0].programs[1].programId'],
    ['program day', (d: any) => (d.plans[0].content.workouts[0].programs[0].day = 'a'), 'plans[0].content.workouts[0].programs[0].day'],
    ['program startWeek', (d: any) => (d.plans[0].content.workouts[0].programs[0].startWeek = null), 'plans[0].content.workouts[0].programs[0].startWeek'],
    ['program roles', (d: any) => (d.plans[0].content.workouts[0].programs[0].roles = []), 'plans[0].content.workouts[0].programs[0].roles'],
    ['program role value', (d: any) => (d.plans[0].content.workouts[0].programs[1].roles.bench = 5), 'plans[0].content.workouts[0].programs[1].roles.bench'],
    ['program accessories', (d: any) => (d.plans[0].content.workouts[0].programs[0].accessories = 'yes'), 'plans[0].content.workouts[0].programs[0].accessories'],
    ['program params', (d: any) => (d.plans[0].content.workouts[0].programs[0].params = []), 'plans[0].content.workouts[0].programs[0].params'],
    ['program param value', (d: any) => (d.plans[0].content.workouts[0].programs[0].params.increment = 'x'), 'plans[0].content.workouts[0].programs[0].params.increment'],
    ['prescription not an object', (d: any) => (d.workouts[0].exercises[0].prescription = 'x'), 'workouts[0].exercises[0].prescription'],
    ['prescription basis', (d: any) => (d.workouts[0].exercises[0].prescription.basisExerciseId = ''), 'workouts[0].exercises[0].prescription.basisExerciseId'],
    ['prescription basisKg', (d: any) => (d.workouts[0].exercises[0].prescription.basisKg = 'x'), 'workouts[0].exercises[0].prescription.basisKg'],
    ['prescription sets', (d: any) => (d.workouts[0].exercises[0].prescription.sets = 1), 'workouts[0].exercises[0].prescription.sets'],
    ['prescription set reps', (d: any) => (d.workouts[0].exercises[0].prescription.sets[0].reps = null), 'workouts[0].exercises[0].prescription.sets[0].reps'],
    ['prescription set amrap', (d: any) => (d.workouts[0].exercises[0].prescription.sets[0].amrap = 0), 'workouts[0].exercises[0].prescription.sets[0].amrap'],
    ['prescription set exactKg', (d: any) => (d.workouts[0].exercises[0].prescription.sets[0].exactKg = 'x'), 'workouts[0].exercises[0].prescription.sets[0].exactKg'],
    ['prescription set kg', (d: any) => (d.workouts[0].exercises[0].prescription.sets[1].kg = 'x'), 'workouts[0].exercises[0].prescription.sets[1].kg'],
    ['prescription set percent', (d: any) => (d.workouts[0].exercises[0].prescription.sets[0].percent = 'x'), 'workouts[0].exercises[0].prescription.sets[0].percent'],
    ['prescription set addKg', (d: any) => delete d.workouts[0].exercises[0].prescription.sets[0].addKg, 'workouts[0].exercises[0].prescription.sets[0].addKg'],
    ['prescription source', (d: any) => (d.workouts[0].exercises[0].prescription.source = 1), 'workouts[0].exercises[0].prescription.source'],
    ['prescription source kind', (d: any) => (d.workouts[0].exercises[0].prescription.source.kind = 'x'), 'workouts[0].exercises[0].prescription.source.kind'],
    ['prescription source programId', (d: any) => (d.workouts[0].exercises[0].prescription.source.programId = ''), 'workouts[0].exercises[0].prescription.source.programId'],
    ['prescription source week', (d: any) => (d.workouts[0].exercises[0].prescription.source.programWeek = 'x'), 'workouts[0].exercises[0].prescription.source.programWeek'],
    ['prescription source label', (d: any) => (d.workouts[0].exercises[0].prescription.source.label = { en: 3 }), 'workouts[0].exercises[0].prescription.source.label.en'],
    ['prescription source label pt', (d: any) => (d.workouts[0].exercises[0].prescription.source.label['pt-BR'] = 3), 'workouts[0].exercises[0].prescription.source.label.pt-BR'],
    ['prescription scheme week', (d: any) => (d.workouts[0].exercises[0].prescription.source = { kind: 'scheme' }), 'workouts[0].exercises[0].prescription.source.schemeWeek'],
    ['prescription phase', (d: any) => (d.workouts[0].exercises[0].prescription.phase = 'x'), 'workouts[0].exercises[0].prescription.phase'],
    ['prescription warnings', (d: any) => (d.workouts[0].exercises[0].prescription.warnings = 'x'), 'workouts[0].exercises[0].prescription.warnings'],
    ['prescription warning value', (d: any) => (d.workouts[0].exercises[0].prescription.warnings[1] = 'x'), 'workouts[0].exercises[0].prescription.warnings[1]'],
    ['rir off the half-point step', (d: any) => (d.workouts[0].exercises[0].sets[0].rir = 1.25), 'workouts[0].exercises[0].sets[0].rir'],
    ['rir above 10', (d: any) => (d.workouts[0].exercises[0].sets[0].rir = 10.5), 'workouts[0].exercises[0].sets[0].rir'],
    ['rir negative', (d: any) => (d.workouts[0].exercises[0].sets[0].rir = -1), 'workouts[0].exercises[0].sets[0].rir'],
  ])('reports %s', (_name, mutate, path) => {
    expect(parseMutated(mutate)).toEqual({ ok: false, errors: [{ code: 'invalidBackup', path }] });
  });

  it('accepts every half point of RIR', () => {
    for (const rir of [0, 0.5, 1, 1.5, 9.5, 10]) {
      expect(parseMutated((d) => (d.workouts[0].exercises[0].sets[0].rir = rir)).ok).toBe(true);
    }
  });

  it('accepts the limits of a reference max', () => {
    for (const kg of [0.01, 1000]) {
      expect(parseMutated((d) => (d.referenceMaxes[0].kg = kg)).ok).toBe(true);
    }
  });

  it('keeps the settings values opaque: unknown strength values still parse', () => {
    expect(parseMutated((d) => (d.settings.focus = 'hypertrophy')).ok).toBe(true);
  });
});

describe('backup v4: remapBackup', () => {
  const maps = { exerciseIds: { 'custom-3': 'custom-30', 'custom-5': 'custom-50' }, planIds: { 7: 70 } as Record<number, number> };

  it('remaps custom exercise ids in reference maxes, percent basis, role mappings and prescription basis', () => {
    const doc = build();
    const r = remapBackup(doc, maps);
    expect(r.referenceMaxes.map((m) => m.exerciseId)).toEqual([
      'barbell-bench-press',
      'barbell-bench-press',
      'custom-30',
      'conventional-deadlift',
      'barbell-back-squat',
    ]);
    const workouts = r.plans[0].content.workouts;
    expect(workouts[0].exercises[0].percent?.basisExerciseId).toBe('custom-30');
    expect(workouts[0].programs?.map((p) => p.roles)).toEqual([
      { lift: 'custom-30' },
      { squat: 'barbell-back-squat', bench: 'custom-50' },
    ]);
    expect(workouts[1].programs?.[0].roles).toEqual({ lift: 'custom-50' });
    expect(r.workouts[0].exercises[0].prescription?.basisExerciseId).toBe('custom-30');
  });

  it('keeps everything else of the new shapes and does not mutate its input', () => {
    const doc = build();
    const before = JSON.stringify(doc);
    const r = remapBackup(doc, maps);
    expect(JSON.stringify(doc)).toBe(before);
    expect(r.plans[0].content.workouts[0].exercises[0].percent?.weeks).toEqual(
      doc.plans[0].content.workouts[0].exercises[0].percent?.weeks,
    );
    expect(r.plans[0].content.workouts[0].programs?.[0]).toMatchObject({ programId: 'smolov-jr', params: { increment: 2.5 } });
    expect(r.workouts[0].exercises[0].prescription?.sets).toEqual(prescription('x').sets);
    expect(r.workouts[0].exercises[0].prescription?.source).toEqual(prescription('x').source);
    expect(r.workouts[0].exercises[1]).not.toHaveProperty('prescription');
  });

  it('leaves exercises without a mapping and plans without percent or programs as they are', () => {
    const doc = build();
    const r = remapBackup(doc, { exerciseIds: {}, planIds: {} });
    expect(r.plans[0].content).toEqual(doc.plans[0].content);
    expect(r.referenceMaxes).toEqual(doc.referenceMaxes);
    expect(r.workouts[0].exercises[1]).not.toHaveProperty('prescription');
    expect(r.plans[0].content.workouts[0].exercises[1]).not.toHaveProperty('percent');
  });
});

describe('backup v4: referencedCustomExerciseIds and summary', () => {
  it('finds custom ids used only as a basis, a role, a reference max or a prescription basis', () => {
    expect(referencedCustomExerciseIds(build())).toEqual(['custom-3', 'custom-5']);
    const doc = build();
    doc.plans = [];
    doc.workouts = [];
    expect(referencedCustomExerciseIds(doc)).toEqual(['custom-3']);
    doc.referenceMaxes = [];
    expect(referencedCustomExerciseIds(doc)).toEqual([]);
  });

  it('leaves the summary shape unchanged', () => {
    expect(Object.keys(backupSummary(build())).sort()).toEqual(
      ['bodyMetrics', 'customExercises', 'exportedAt', 'firstWorkoutAt', 'lastWorkoutAt', 'plans', 'profileName', 'workouts'],
    );
  });
});
