import {
  backupFileName,
  backupSummary,
  buildBackup,
  parseBackup,
  referencedCustomExerciseIds,
  remapBackup,
  serializeBackup,
  type BackupData,
  type BackupDocument,
  type BackupPlan,
  type BackupWorkout,
} from './backup';

const META = { exportedAt: '2026-11-20T10:00:00.000Z', appVersion: '3.0.0' };

function plan(id: number, active: boolean, archivedAt: string | null, exerciseIds: string[]): BackupPlan {
  return {
    id,
    active,
    content: {
      name: `Plan ${id}`,
      description: '',
      sessionsPerWeek: 3,
      cycle: { loadWeeks: 4, deloadWeeks: 1, deloadVolumeFactor: 0.6, deloadLoadFactor: 0.9 },
      workouts: [
        {
          id: 'w1',
          name: 'Day A',
          exercises: exerciseIds.map((exerciseId, i) => ({
            id: `e${i}`,
            exerciseId,
            sets: 3,
            repMin: 6,
            repMax: 10,
            ...(i === 0 ? { targetRir: 2, restSeconds: 120, startLoadKg: 42.5, note: 'slow' } : {}),
          })),
        },
      ],
    },
    cycleState: { cycleNumber: 2, phase: 'deload', week: 1, sessionsDoneThisWeek: 1, nextWorkoutIndex: 0 },
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-02-01T08:00:00.000Z',
    archivedAt,
  };
}

function workout(over: Partial<BackupWorkout>): BackupWorkout {
  return {
    id: 1,
    planId: null,
    planWorkoutId: null,
    name: 'Free',
    status: 'completed',
    phase: 'load',
    cycleNumber: null,
    cycleWeek: null,
    startedAt: '2026-03-01T09:00:00.000Z',
    completedAt: '2026-03-01T10:00:00.000Z',
    notes: 'felt good',
    exercises: [
      {
        exerciseId: 'bench-press',
        planExerciseId: null,
        target: null,
        note: '',
        sets: [
          { kind: 'warmup', weightKg: 20, reps: 10, rir: null, done: true },
          { kind: 'working', weightKg: 42.5, reps: 8, rir: 2, done: true },
        ],
      },
    ],
    ...over,
  };
}

function fixtureData(): BackupData {
  return {
    profileName: 'João Silva',
    settings: { language: 'pt-BR', theme: 'dark', restDefault: 90, notifications: true, lastBackupAt: null, days: [1, 3, 5] },
    customExercises: [
      {
        id: 'custom-3',
        name: 'Curl, strict',
        primaryMuscle: 'biceps',
        secondaryMuscles: ['forearms'],
        equipment: 'dumbbell',
        mechanics: 'isolation',
        archived: false,
      },
      {
        id: 'custom-9',
        name: 'Sled push',
        primaryMuscle: 'quads',
        secondaryMuscles: [],
        equipment: 'other',
        mechanics: 'compound',
        archived: true,
      },
    ],
    exerciseSettings: [
      { exerciseId: 'bench-press', incrementKg: 1.25, barKg: 20 },
      { exerciseId: 'custom-3', note: 'elbows in' },
    ],
    plans: [plan(4, true, null, ['bench-press', 'custom-3']), plan(2, false, '2026-04-01T00:00:00.000Z', ['custom-9'])],
    workouts: [
      workout({
        id: 10,
        planId: 4,
        planWorkoutId: 'w1',
        name: 'Day A',
        phase: 'deload',
        cycleNumber: 2,
        cycleWeek: 1,
        startedAt: '2026-05-02T09:00:00.000Z',
        completedAt: '2026-05-02T10:00:00.000Z',
        exercises: [
          {
            exerciseId: 'custom-3',
            planExerciseId: 'e1',
            target: { sets: 3, repMin: 6, repMax: 10, targetRir: 2, restSeconds: 90 },
            note: 'ok',
            sets: [{ kind: 'working', weightKg: 12, reps: 10, rir: null, done: true }],
          },
        ],
      }),
      workout({ id: 11 }),
      workout({ id: 12, status: 'in_progress', completedAt: null, planId: 2, startedAt: '2026-06-01T09:00:00.000Z' }),
    ],
    bodyMetrics: [
      { date: '2026-05-01', kind: 'weight', value: 80.5 },
      { date: '2026-05-01', kind: 'waist', value: 90 },
    ],
  };
}

function build(): BackupDocument {
  return buildBackup(fixtureData(), META);
}

/** Parses a mutated copy of the fixture document. */
function parseMutated(mutate: (doc: any) => void) {
  const doc = JSON.parse(serializeBackup(build()));
  mutate(doc);
  return parseBackup(JSON.stringify(doc));
}

describe('buildBackup / serializeBackup / parseBackup', () => {
  it('builds the document envelope', () => {
    const doc = build();
    expect(doc.format).toBe('cycle-backup');
    expect(doc.version).toBe(1);
    expect(doc.exportedAt).toBe('2026-11-20T10:00:00.000Z');
    expect(doc.appVersion).toBe('3.0.0');
    expect(doc.profile).toEqual({ name: 'João Silva' });
  });

  it('serializes with a 2-space indent', () => {
    expect(serializeBackup(build()).startsWith('{\n  "format": "cycle-backup",\n  "version": 1,')).toBe(true);
  });

  it('round-trips every record', () => {
    const doc = build();
    const result = parseBackup(serializeBackup(doc));
    expect(result).toEqual({ ok: true, backup: doc });
  });

  it('accepts the drop set kind', () => {
    const result = parseMutated((d) => (d.workouts[0].exercises[0].sets[0].kind = 'drop'));
    expect(result.ok).toBe(true);
  });

  it('ignores unknown properties and drops them from the result', () => {
    const doc = build();
    const result = parseMutated((d) => {
      d.extra = 1;
      d.profile.avatar = 'x';
      d.plans[0].foo = true;
      d.workouts[0].exercises[0].sets[0].bar = 1;
      d.settings.future = 'kept as a setting';
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup).toEqual({ ...doc, settings: { ...doc.settings, future: 'kept as a setting' } });
    }
  });

  it('defaults missing optional sections to empty arrays', () => {
    const result = parseMutated((d) => {
      delete d.exerciseSettings;
      delete d.bodyMetrics;
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup.exerciseSettings).toEqual([]);
      expect(result.backup.bodyMetrics).toEqual([]);
    }
  });
});

describe('parseBackup errors', () => {
  it('reports invalid JSON', () => {
    expect(parseBackup('{nope')).toEqual({ ok: false, errors: [{ code: 'invalidJson' }] });
  });

  it('reports a non-object top level', () => {
    expect(parseBackup('[]')).toEqual({ ok: false, errors: [{ code: 'notAnObject' }] });
    expect(parseBackup('null')).toEqual({ ok: false, errors: [{ code: 'notAnObject' }] });
    expect(parseBackup('3')).toEqual({ ok: false, errors: [{ code: 'notAnObject' }] });
  });

  it('reports a wrong format as the only error', () => {
    expect(parseMutated((d) => {
      d.format = 'other';
      d.plans = 'broken';
    })).toEqual({ ok: false, errors: [{ code: 'unsupportedFormat', path: 'format' }] });
  });

  it('reports a wrong version as the only error', () => {
    expect(parseMutated((d) => {
      d.version = 2;
      d.plans = 'broken';
    })).toEqual({ ok: false, errors: [{ code: 'unsupportedVersion', path: 'version' }] });
  });

  it('reports a plan without content', () => {
    expect(parseMutated((d) => delete d.plans[0].content)).toEqual({
      ok: false,
      errors: [{ code: 'invalidBackup', path: 'plans[0].content' }],
    });
  });

  it('reports a plan whose workouts is not an array', () => {
    expect(parseMutated((d) => (d.plans[0].content.workouts = {}))).toEqual({
      ok: false,
      errors: [{ code: 'invalidBackup', path: 'plans[0].content.workouts' }],
    });
  });

  it('reports a set with an unknown kind', () => {
    expect(parseMutated((d) => (d.workouts[1].exercises[0].sets[1].kind = 'warm'))).toEqual({
      ok: false,
      errors: [{ code: 'invalidBackup', path: 'workouts[1].exercises[0].sets[1].kind' }],
    });
  });

  it('reports a non-numeric weight', () => {
    expect(parseMutated((d) => (d.workouts[1].exercises[0].sets[1].weightKg = '42'))).toEqual({
      ok: false,
      errors: [{ code: 'invalidBackup', path: 'workouts[1].exercises[0].sets[1].weightKg' }],
    });
  });

  it('reports one error per broken section (the first problem of each)', () => {
    const result = parseMutated((d) => {
      d.customExercises[1].equipment = 'sled';
      d.customExercises[0].primaryMuscle = 'neck';
      d.workouts[0].status = 'paused';
      d.bodyMetrics[0].value = 'x';
    });
    expect(result).toEqual({
      ok: false,
      errors: [
        { code: 'invalidBackup', path: 'customExercises[0].primaryMuscle' },
        { code: 'invalidBackup', path: 'workouts[0].status' },
        { code: 'invalidBackup', path: 'bodyMetrics[0].value' },
      ],
    });
  });

  it.each([
    ['exportedAt', (d: any) => (d.exportedAt = ''), 'exportedAt'],
    ['appVersion', (d: any) => delete d.appVersion, 'appVersion'],
    ['profile', (d: any) => (d.profile = 'x'), 'profile'],
    ['profile name', (d: any) => (d.profile.name = 1), 'profile.name'],
    ['settings', (d: any) => (d.settings = []), 'settings'],
    ['settings value', (d: any) => (d.settings.bad = { a: 1 }), 'settings.bad'],
    ['settings array', (d: any) => (d.settings.bad = ['a']), 'settings.bad'],
    ['customExercises', (d: any) => (d.customExercises = null), 'customExercises'],
    ['custom mechanics', (d: any) => (d.customExercises[0].mechanics = 'x'), 'customExercises[0].mechanics'],
    ['custom archived', (d: any) => (d.customExercises[0].archived = 'no'), 'customExercises[0].archived'],
    ['secondary muscle', (d: any) => (d.customExercises[0].secondaryMuscles = ['x']), 'customExercises[0].secondaryMuscles[0]'],
    ['exercise settings item', (d: any) => (d.exerciseSettings[0] = 1), 'exerciseSettings[0]'],
    ['exercise settings increment', (d: any) => (d.exerciseSettings[0].incrementKg = 'a'), 'exerciseSettings[0].incrementKg'],
    ['exercise settings note', (d: any) => (d.exerciseSettings[1].note = 1), 'exerciseSettings[1].note'],
    ['exercise settings bar', (d: any) => (d.exerciseSettings[0].barKg = 'a'), 'exerciseSettings[0].barKg'],
    ['plan cycle', (d: any) => delete d.plans[0].content.cycle, 'plans[0].content.cycle'],
    ['plan cycle value', (d: any) => (d.plans[0].content.cycle.loadWeeks = null), 'plans[0].content.cycle.loadWeeks'],
    ['plan state phase', (d: any) => (d.plans[0].cycleState.phase = 'x'), 'plans[0].cycleState.phase'],
    ['plan exercise sets', (d: any) => (d.plans[0].content.workouts[0].exercises[0].sets = Infinity), 'plans[0].content.workouts[0].exercises[0].sets'],
    ['plan exercise rir', (d: any) => (d.plans[0].content.workouts[0].exercises[0].targetRir = 'a'), 'plans[0].content.workouts[0].exercises[0].targetRir'],
    ['plan exercise rest', (d: any) => (d.plans[0].content.workouts[0].exercises[0].restSeconds = 'a'), 'plans[0].content.workouts[0].exercises[0].restSeconds'],
    ['plan exercise load', (d: any) => (d.plans[0].content.workouts[0].exercises[0].startLoadKg = 'a'), 'plans[0].content.workouts[0].exercises[0].startLoadKg'],
    ['plan exercise note', (d: any) => (d.plans[0].content.workouts[0].exercises[0].note = 1), 'plans[0].content.workouts[0].exercises[0].note'],
    ['plan createdAt', (d: any) => (d.plans[0].createdAt = ''), 'plans[0].createdAt'],
    ['plan archivedAt', (d: any) => (d.plans[1].archivedAt = 5), 'plans[1].archivedAt'],
    ['workout target', (d: any) => (d.workouts[0].exercises[0].target = 'x'), 'workouts[0].exercises[0].target'],
    ['workout target sets', (d: any) => (d.workouts[0].exercises[0].target.sets = 'x'), 'workouts[0].exercises[0].target.sets'],
    ['workout target rir', (d: any) => (d.workouts[0].exercises[0].target.targetRir = 'x'), 'workouts[0].exercises[0].target.targetRir'],
    ['workout target rest', (d: any) => (d.workouts[0].exercises[0].target.restSeconds = 'x'), 'workouts[0].exercises[0].target.restSeconds'],
    ['workout phase', (d: any) => (d.workouts[0].phase = 'x'), 'workouts[0].phase'],
    ['workout notes', (d: any) => (d.workouts[0].notes = 4), 'workouts[0].notes'],
    ['workout exercise note', (d: any) => (d.workouts[0].exercises[0].note = 4), 'workouts[0].exercises[0].note'],
    ['set done', (d: any) => (d.workouts[0].exercises[0].sets[0].done = 1), 'workouts[0].exercises[0].sets[0].done'],
    ['body date', (d: any) => (d.bodyMetrics[0].date = ''), 'bodyMetrics[0].date'],
  ])('reports %s', (_name, mutate, path) => {
    expect(parseMutated(mutate)).toEqual({ ok: false, errors: [{ code: 'invalidBackup', path }] });
  });

  it('defaults missing optional workout notes to empty text', () => {
    const result = parseMutated((d) => {
      delete d.workouts[0].notes;
      delete d.workouts[0].exercises[0].note;
      delete d.workouts[0].exercises[0].target;
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup.workouts[0].notes).toBe('');
      expect(result.backup.workouts[0].exercises[0].note).toBe('');
      expect(result.backup.workouts[0].exercises[0].target).toBeNull();
    }
  });
});

describe('backupSummary', () => {
  it('counts records and finds the first and last completed workout', () => {
    expect(backupSummary(build())).toEqual({
      profileName: 'João Silva',
      exportedAt: '2026-11-20T10:00:00.000Z',
      plans: 2,
      workouts: 3,
      customExercises: 2,
      bodyMetrics: 2,
      firstWorkoutAt: '2026-03-01T10:00:00.000Z',
      lastWorkoutAt: '2026-05-02T10:00:00.000Z',
    });
  });

  it('returns null dates without completed workouts', () => {
    const doc = buildBackup({ ...fixtureData(), workouts: [] }, META);
    const s = backupSummary(doc);
    expect(s.firstWorkoutAt).toBeNull();
    expect(s.lastWorkoutAt).toBeNull();
    expect(s.workouts).toBe(0);
  });
});

describe('backupFileName', () => {
  it('slugifies the profile name and formats the date', () => {
    expect(backupFileName('João Silva', new Date(2026, 10, 20))).toBe('cycle-backup-joao-silva-20261120.json');
  });

  it('falls back to "profile"', () => {
    expect(backupFileName('  ***  ', new Date(2026, 0, 5))).toBe('cycle-backup-profile-20260105.json');
    expect(backupFileName('', new Date(2026, 0, 5))).toBe('cycle-backup-profile-20260105.json');
  });

  it('trims separators and collapses runs', () => {
    expect(backupFileName('  Ana -- Maria_2! ', new Date(2026, 11, 31))).toBe('cycle-backup-ana-maria-2-20261231.json');
  });
});

describe('remapBackup', () => {
  const maps = { exerciseIds: { 'custom-3': 'custom-30', 'custom-9': 'custom-90' }, planIds: { 4: 40 } as Record<number, number> };

  it('replaces custom exercise ids and plan ids everywhere, leaving built-ins', () => {
    const doc = build();
    const r = remapBackup(doc, maps);

    expect(r.plans.map((p) => p.id)).toEqual([40, 2]);
    expect(r.plans[0].content.workouts[0].exercises.map((e) => e.exerciseId)).toEqual(['bench-press', 'custom-30']);
    expect(r.plans[1].content.workouts[0].exercises.map((e) => e.exerciseId)).toEqual(['custom-90']);
    expect(r.workouts.map((w) => w.planId)).toEqual([40, null, null]);
    expect(r.workouts[0].exercises[0].exerciseId).toBe('custom-30');
    expect(r.workouts[1].exercises[0].exerciseId).toBe('bench-press');
    expect(r.exerciseSettings.map((s) => s.exerciseId)).toEqual(['bench-press', 'custom-30']);
    expect(r.exerciseSettings[1].note).toBe('elbows in');
  });

  it('does not mutate its input', () => {
    const doc = build();
    const before = JSON.stringify(doc);
    remapBackup(doc, maps);
    expect(JSON.stringify(doc)).toBe(before);
  });
});

describe('referencedCustomExerciseIds', () => {
  it('lists the distinct custom ids used in plans, workouts and exercise settings', () => {
    expect(referencedCustomExerciseIds(build())).toEqual(['custom-3', 'custom-9']);
  });

  it('includes ids that only appear in exercise settings', () => {
    const doc = buildBackup(
      { ...fixtureData(), plans: [], workouts: [], exerciseSettings: [{ exerciseId: 'custom-5', barKg: 15 }] },
      META,
    );
    expect(referencedCustomExerciseIds(doc)).toEqual(['custom-5']);
  });
});
