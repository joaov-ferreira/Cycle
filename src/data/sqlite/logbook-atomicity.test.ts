import { NodeSqliteDatabase } from '@/test-utils/node-sqlite';

import { runMigrations } from '../migrate';
import { migrations } from '../migrations';
import { createSqliteRepositories } from './sqlite-repositories';

describe('SQLite logbook atomicity', () => {
  async function setup() {
    const db = new NodeSqliteDatabase();
    await db.execAsync('PRAGMA foreign_keys = ON');
    await runMigrations(db, migrations);
    const repos = createSqliteRepositories(db);
    const profile = await repos.profiles.create({ name: 'Ana' });
    // Makes any insert of a set with 7 reps fail halfway through a multi-statement write.
    await db.execAsync(`CREATE TRIGGER fail_on_seven BEFORE INSERT ON workout_sets WHEN NEW.reps = 7
      BEGIN SELECT RAISE(ABORT, 'boom'); END`);
    return { db, repos, profileId: profile.id };
  }
  const exercise = (reps: number) => ({
    exerciseId: 'barbell-bench-press',
    planExerciseId: null,
    target: null,
    note: '',
    sets: [{ kind: 'working' as const, weightKg: 60, reps, rir: null, done: true }],
  });
  const base = {
    planId: null,
    planWorkoutId: null,
    name: 'W',
    phase: 'load' as const,
    cycleNumber: null,
    cycleWeek: null,
    startedAt: '2026-11-05T09:00:00.000Z',
    notes: 'kept',
  };

  it('rolls a failed draft overwrite back, keeping the previous draft', async () => {
    const { repos, profileId } = await setup();
    const saved = await repos.workouts.saveDraft(profileId, { ...base, exercises: [exercise(8)] });
    await expect(
      repos.workouts.saveDraft(profileId, { ...base, notes: 'lost', exercises: [exercise(7)] }),
    ).rejects.toThrow('boom');
    expect(await repos.workouts.getInProgress(profileId)).toEqual(saved);
  });

  it('rolls a failed completion and a failed amend back', async () => {
    const { repos, profileId } = await setup();
    const saved = await repos.workouts.saveDraft(profileId, { ...base, exercises: [exercise(8)] });
    await expect(
      repos.workouts.complete(profileId, saved.id, { exercises: [exercise(7)], notes: 'lost' }),
    ).rejects.toThrow('boom');
    expect(await repos.workouts.getInProgress(profileId)).toEqual(saved);

    const done = await repos.workouts.complete(profileId, saved.id, {
      exercises: saved.exercises,
      notes: 'kept',
      completedAt: '2026-11-05T11:00:00.000Z',
    });
    await expect(
      repos.workouts.amend(profileId, done.id, { exercises: [exercise(7)], notes: 'lost' }),
    ).rejects.toThrow('boom');
    expect(await repos.workouts.get(profileId, done.id)).toEqual(done);
  });

  it('keeps the data across repository instances', async () => {
    const { db, repos, profileId } = await setup();
    const saved = await repos.workouts.saveDraft(profileId, { ...base, exercises: [exercise(8)] });
    const plan = await repos.plans.create(profileId, {
      name: 'P',
      description: '',
      workouts: [{ id: 'w', name: 'W', exercises: [{ id: 'e', exerciseId: 'x', sets: 1, repMin: 5, repMax: 8 }] }],
      sessionsPerWeek: 1,
      cycle: { loadWeeks: 4, deloadWeeks: 1, deloadVolumeFactor: 0.5, deloadLoadFactor: 0.9 },
    });
    const again = createSqliteRepositories(db);
    expect(await again.workouts.getInProgress(profileId)).toEqual(saved);
    expect(await again.plans.get(profileId, plan.id)).toEqual(plan);
  });
});
