import {
  buildBackup,
  parseBackup,
  remapBackup,
  serializeBackup,
  type BackupData,
  type BackupDocument,
} from '@/domain/backup';
import type { PlanContent } from '@/domain/plan';

import { ProfileNotFoundError, type Clock, type Repositories } from '../repositories';
import { customInput, draft, entry, movableClock, planContent, prescriptionSnapshot, set, v4PlanContent } from './fixtures';

const META = { exportedAt: '2026-12-01T00:00:00.000Z', appVersion: '3.0.0' };

export const toDocument = (data: BackupData): BackupDocument => buildBackup(data, META);

/** Replaces database ids by their position, so two exports of equal content compare equal. */
export function normalizeIds(data: BackupData): BackupData {
  const exerciseIds = Object.fromEntries(data.customExercises.map((c, i) => [c.id, `custom-#${i}`]));
  const planIds = Object.fromEntries(data.plans.map((p, i) => [p.id, i + 1]));
  const doc = toDocument(data);
  const remapped = remapBackup(doc, { exerciseIds, planIds });
  return {
    ...data,
    customExercises: data.customExercises.map((c, i) => ({ ...c, id: `custom-#${i}` })),
    exerciseSettings: [...remapped.exerciseSettings].sort((x, y) => (x.exerciseId < y.exerciseId ? -1 : 1)),
    referenceMaxes: remapped.referenceMaxes,
    plans: remapped.plans,
    workouts: remapped.workouts.map((w, i) => ({ ...w, id: i + 1 })),
  };
}

export function describeBackupContract(factory: (clock: Clock) => Promise<Repositories>) {
  async function setup() {
    const time = movableClock('2026-11-05T10:00:00.000Z');
    const repos = await factory(time.clock);
    const a = await repos.profiles.create({ name: 'Ana' });
    const b = await repos.profiles.create({ name: 'Bruno' });
    await repos.profiles.setActiveId(a.id);
    return { repos, a: a.id, b: b.id, time };
  }

  const supersetPlan = (): PlanContent => {
    const content = planContent({ name: 'Archived plan' });
    content.workouts[0].exercises[0].supersetGroup = 'A';
    content.workouts[0].exercises[1].supersetGroup = 'A';
    return content;
  };

  /** Seeds profile `a` with every kind of data a backup holds. */
  async function seed(repos: Repositories, a: number, time: ReturnType<typeof movableClock>) {
    await repos.settings.update(a, {
      language: 'pt-BR',
      theme: 'light',
      onboardingCompleted: true,
      experience: 'advanced',
      defaultRestSeconds: 120,
      restNotifications: false,
      keepAwake: false,
      barKg: 15,
      platesKg: [2.5, 20, 5, 10],
      lastBackupAt: '2026-11-01T08:00:00.000Z',
      focus: 'strength',
      e1rmFormula: 'rts',
      effortScale: 'rpe',
      roundingMode: 'up',
    });
    await repos.exercises.createCustom(a, customInput());
    await repos.exercises.createCustom(
      a,
      customInput({ name: 'Old move', primaryMuscle: 'back', secondaryMuscles: [], equipment: 'other', mechanics: 'compound' }),
    );
    await repos.exercises.setArchived(a, 'custom-2', true);
    await repos.exercises.setIncrementOverride(a, 'barbell-bench-press', 1.25);
    await repos.exercises.setExerciseNote(a, 'custom-1', 'seat on position 4');
    await repos.exercises.setExerciseBar(a, 'custom-1', 10);

    time.set('2026-11-02T08:00:00.000Z');
    const plan1 = await repos.plans.create(a, planContent());
    time.set('2026-11-03T08:00:00.000Z');
    const plan2 = await repos.plans.create(a, supersetPlan());
    time.set('2026-11-04T08:00:00.000Z');
    await repos.plans.update(a, plan1.id, planContent({ description: 'Edited' }));
    await repos.plans.setCycleState(a, plan1.id, {
      cycleNumber: 2,
      phase: 'deload',
      week: 1,
      sessionsDoneThisWeek: 1,
      nextWorkoutIndex: 1,
    });
    await repos.plans.setArchived(a, plan2.id, true);
    await repos.plans.setActiveId(a, plan1.id);

    const finish = async (overrides: Parameters<typeof draft>[0], completedAt: string) => {
      const saved = await repos.workouts.saveDraft(a, draft(overrides));
      return repos.workouts.complete(a, saved.id, { exercises: saved.exercises, notes: saved.notes, completedAt });
    };
    await finish(
      {
        planId: plan1.id,
        planWorkoutId: 'w1',
        name: 'Upper',
        cycleNumber: 1,
        cycleWeek: 2,
        notes: 'good',
        startedAt: '2026-11-02T09:00:00.000Z',
        exercises: [
          entry('barbell-bench-press', [set(40, 10, { kind: 'warmup' }), set(80, 8, { rir: 2 }), set(64, 8, { kind: 'drop' })], {
            planExerciseId: 'e1',
            target: { sets: 3, repMin: 6, repMax: 10, targetRir: 2, restSeconds: 120 },
            supersetGroup: 'A',
          }),
          entry('custom-1', [set(20, 12)], { planExerciseId: 'e2', supersetGroup: 'A', note: 'felt ok' }),
        ],
      },
      '2026-11-02T10:00:00.000Z',
    );
    await finish(
      { name: 'Free', startedAt: '2026-11-03T09:00:00.000Z', exercises: [entry('custom-2', [set(30, 10, { done: false })])] },
      '2026-11-03T10:00:00.000Z',
    );
    await finish(
      { planId: plan2.id, planWorkoutId: 'w2', name: 'Lower', phase: 'deload', startedAt: '2026-11-04T09:00:00.000Z', exercises: [entry('barbell-back-squat', [set(100, 5)])] },
      '2026-11-04T10:00:00.000Z',
    );
    await repos.workouts.saveDraft(
      a,
      draft({
        planId: plan1.id,
        planWorkoutId: 'w1',
        name: 'In progress',
        startedAt: '2026-11-05T09:00:00.000Z',
        exercises: [entry('custom-1', [set(20, 12, { done: false })])],
      }),
    );

    await repos.bodyMetrics.save(a, { date: '2026-11-03', kind: 'weight', value: 80.5 });
    await repos.bodyMetrics.save(a, { date: '2026-11-01', kind: 'waist', value: 90 });
    await repos.bodyMetrics.save(a, { date: '2026-11-01', kind: 'weight', value: 81 });
  }

  describe('backup: exportProfile', () => {
    it('exports a profile with no data as defaults and empty lists', async () => {
      const { repos, b } = await setup();
      expect(await repos.backup.exportProfile(b)).toEqual({
        profileName: 'Bruno',
        settings: {
          language: 'system',
          theme: 'dark',
          onboardingCompleted: false,
          experience: 'intermediate',
          defaultRestSeconds: 90,
          restNotifications: true,
          keepAwake: true,
          barKg: 20,
          platesKg: [25, 20, 15, 10, 5, 2.5, 1.25],
          lastBackupAt: null,
          focus: 'general',
          e1rmFormula: 'epley',
          effortScale: 'rir',
          roundingMode: 'nearest',
        },
        customExercises: [],
        exerciseSettings: [],
        referenceMaxes: [],
        plans: [],
        workouts: [],
        bodyMetrics: [],
      });
    });

    it('exports everything of a seeded profile', async () => {
      const { repos, a, time } = await setup();
      await seed(repos, a, time);
      const exported = await repos.backup.exportProfile(a);
      const content = planContent();
      expect(exported).toEqual<BackupData>({
        profileName: 'Ana',
        settings: {
          language: 'pt-BR',
          theme: 'light',
          onboardingCompleted: true,
          experience: 'advanced',
          defaultRestSeconds: 120,
          restNotifications: false,
          keepAwake: false,
          barKg: 15,
          platesKg: [20, 10, 5, 2.5],
          lastBackupAt: '2026-11-01T08:00:00.000Z',
          focus: 'strength',
          e1rmFormula: 'rts',
          effortScale: 'rpe',
          roundingMode: 'up',
        },
        customExercises: [
          { id: 'custom-1', name: 'Cable fly', primaryMuscle: 'chest', secondaryMuscles: ['shoulders'], equipment: 'cable', mechanics: 'isolation', archived: false },
          { id: 'custom-2', name: 'Old move', primaryMuscle: 'back', secondaryMuscles: [], equipment: 'other', mechanics: 'compound', archived: true },
        ],
        exerciseSettings: [
          { exerciseId: 'barbell-bench-press', incrementKg: 1.25 },
          { exerciseId: 'custom-1', note: 'seat on position 4', barKg: 10 },
        ],
        referenceMaxes: [],
        plans: [
          {
            id: 1,
            active: true,
            content: { ...content, description: 'Edited' },
            cycleState: { cycleNumber: 2, phase: 'deload', week: 1, sessionsDoneThisWeek: 1, nextWorkoutIndex: 1 },
            createdAt: '2026-11-02T08:00:00.000Z',
            updatedAt: '2026-11-04T08:00:00.000Z',
            archivedAt: null,
          },
          {
            id: 2,
            active: false,
            content: supersetPlan(),
            cycleState: { cycleNumber: 1, phase: 'load', week: 1, sessionsDoneThisWeek: 0, nextWorkoutIndex: 0 },
            createdAt: '2026-11-03T08:00:00.000Z',
            updatedAt: '2026-11-03T08:00:00.000Z',
            archivedAt: '2026-11-04T08:00:00.000Z',
          },
        ],
        workouts: [
          {
            id: 1,
            planId: 1,
            planWorkoutId: 'w1',
            name: 'Upper',
            status: 'completed',
            phase: 'load',
            cycleNumber: 1,
            cycleWeek: 2,
            startedAt: '2026-11-02T09:00:00.000Z',
            completedAt: '2026-11-02T10:00:00.000Z',
            notes: 'good',
            exercises: [
              {
                exerciseId: 'barbell-bench-press',
                planExerciseId: 'e1',
                target: { sets: 3, repMin: 6, repMax: 10, targetRir: 2, restSeconds: 120 },
                note: '',
                supersetGroup: 'A',
                sets: [
                  { kind: 'warmup', weightKg: 40, reps: 10, rir: null, done: true },
                  { kind: 'working', weightKg: 80, reps: 8, rir: 2, done: true },
                  { kind: 'drop', weightKg: 64, reps: 8, rir: null, done: true },
                ],
              },
              {
                exerciseId: 'custom-1',
                planExerciseId: 'e2',
                target: null,
                note: 'felt ok',
                supersetGroup: 'A',
                sets: [{ kind: 'working', weightKg: 20, reps: 12, rir: null, done: true }],
              },
            ],
          },
          {
            id: 2,
            planId: null,
            planWorkoutId: null,
            name: 'Free',
            status: 'completed',
            phase: 'load',
            cycleNumber: null,
            cycleWeek: null,
            startedAt: '2026-11-03T09:00:00.000Z',
            completedAt: '2026-11-03T10:00:00.000Z',
            notes: '',
            exercises: [
              {
                exerciseId: 'custom-2',
                planExerciseId: null,
                target: null,
                note: '',
                supersetGroup: null,
                sets: [{ kind: 'working', weightKg: 30, reps: 10, rir: null, done: false }],
              },
            ],
          },
          {
            id: 3,
            planId: 2,
            planWorkoutId: 'w2',
            name: 'Lower',
            status: 'completed',
            phase: 'deload',
            cycleNumber: null,
            cycleWeek: null,
            startedAt: '2026-11-04T09:00:00.000Z',
            completedAt: '2026-11-04T10:00:00.000Z',
            notes: '',
            exercises: [
              {
                exerciseId: 'barbell-back-squat',
                planExerciseId: null,
                target: null,
                note: '',
                supersetGroup: null,
                sets: [{ kind: 'working', weightKg: 100, reps: 5, rir: null, done: true }],
              },
            ],
          },
          {
            id: 4,
            planId: 1,
            planWorkoutId: 'w1',
            name: 'In progress',
            status: 'in_progress',
            phase: 'load',
            cycleNumber: null,
            cycleWeek: null,
            startedAt: '2026-11-05T09:00:00.000Z',
            completedAt: null,
            notes: '',
            exercises: [
              {
                exerciseId: 'custom-1',
                planExerciseId: null,
                target: null,
                note: '',
                supersetGroup: null,
                sets: [{ kind: 'working', weightKg: 20, reps: 12, rir: null, done: false }],
              },
            ],
          },
        ],
        bodyMetrics: [
          { date: '2026-11-01', kind: 'waist', value: 90 },
          { date: '2026-11-01', kind: 'weight', value: 81 },
          { date: '2026-11-03', kind: 'weight', value: 80.5 },
        ],
      });
    });

    it('does not mix in the data of another profile', async () => {
      const { repos, a, b, time } = await setup();
      await seed(repos, a, time);
      const exported = await repos.backup.exportProfile(b);
      expect(exported.customExercises).toEqual([]);
      expect(exported.plans).toEqual([]);
      expect(exported.workouts).toEqual([]);
      expect(exported.bodyMetrics).toEqual([]);
      expect(exported.exerciseSettings).toEqual([]);
    });

    it('throws ProfileNotFoundError for an unknown profile', async () => {
      const { repos } = await setup();
      await expect(repos.backup.exportProfile(99)).rejects.toThrow(ProfileNotFoundError);
    });
  });

  describe('backup: restoreAsNewProfile', () => {
    it('restores an export as a new, equivalent profile without touching the original', async () => {
      const { repos, a, time } = await setup();
      await seed(repos, a, time);
      const before = await repos.backup.exportProfile(a);

      const restored = await repos.backup.restoreAsNewProfile(toDocument(before), 'Ana (restored)');
      expect(restored).toEqual({ id: 3, name: 'Ana (restored)', createdAt: '2026-11-04T08:00:00.000Z' });
      expect(await repos.profiles.getById(restored.id)).toEqual(restored);

      const copy = await repos.backup.exportProfile(restored.id);
      expect(copy.profileName).toBe('Ana (restored)');
      expect(normalizeIds({ ...copy, profileName: 'Ana' })).toEqual(normalizeIds(before));

      // The original is untouched and still the active profile.
      expect(await repos.backup.exportProfile(a)).toEqual(before);
      expect(await repos.profiles.getActiveId()).toBe(a);
      expect(await repos.profiles.list()).toHaveLength(3);
    });

    it('remaps custom exercise and plan ids to the new profile', async () => {
      const { repos, a, time } = await setup();
      await seed(repos, a, time);
      const original = await repos.backup.exportProfile(a);
      const restored = await repos.backup.restoreAsNewProfile(toDocument(original), 'Copy');
      const copy = await repos.backup.exportProfile(restored.id);

      const originalIds = original.customExercises.map((c) => c.id);
      const copyIds = copy.customExercises.map((c) => c.id);
      expect(copyIds).toHaveLength(2);
      expect(copyIds.some((id) => originalIds.includes(id))).toBe(false);
      expect((await repos.exercises.listCustom(restored.id)).map((e) => e.id)).toEqual(copyIds);

      const used = new Set<string>();
      for (const p of copy.plans) for (const w of p.content.workouts) for (const e of w.exercises) used.add(e.exerciseId);
      for (const w of copy.workouts) for (const e of w.exercises) used.add(e.exerciseId);
      for (const s of copy.exerciseSettings) used.add(s.exerciseId);
      const usedCustom = [...used].filter((id) => id.startsWith('custom-'));
      expect(usedCustom.length).toBeGreaterThan(0);
      for (const id of usedCustom) {
        expect(copyIds).toContain(id);
        expect(originalIds).not.toContain(id);
      }

      const copyPlanIds = copy.plans.map((p) => p.id);
      const originalPlanIds = original.plans.map((p) => p.id);
      expect(copyPlanIds.some((id) => originalPlanIds.includes(id))).toBe(false);
      for (const w of copy.workouts) {
        if (w.planId !== null) expect(copyPlanIds).toContain(w.planId);
      }
      expect(copy.workouts.map((w) => w.planId === null ? null : copyPlanIds.indexOf(w.planId))).toEqual([0, null, 1, 0]);

      // The restored profile owns its data through the repositories too.
      expect((await repos.plans.list(restored.id, { includeArchived: true })).map((p) => p.id)).toEqual(copyPlanIds);
      expect(await repos.plans.getActiveId(restored.id)).toBe(copyPlanIds[0]);
      expect(await repos.exercises.isReferenced(restored.id, copyIds[0])).toBe(true);
      expect(await repos.workouts.getInProgress(restored.id)).toMatchObject({ name: 'In progress', planId: copyPlanIds[0] });
      expect(await repos.exercises.getExerciseSettings(restored.id)).toEqual({
        'barbell-bench-press': { incrementKg: 1.25 },
        [copyIds[0]]: { note: 'seat on position 4', barKg: 10 },
      });
    });

    it('preserves the timestamps of the backup', async () => {
      const { repos, a, time } = await setup();
      await seed(repos, a, time);
      const original = await repos.backup.exportProfile(a);
      time.set('2027-01-01T00:00:00.000Z');
      const restored = await repos.backup.restoreAsNewProfile(toDocument(original), 'Copy');
      expect(restored.createdAt).toBe('2027-01-01T00:00:00.000Z');
      const copy = await repos.backup.exportProfile(restored.id);
      expect(copy.plans.map((p) => [p.createdAt, p.updatedAt, p.archivedAt])).toEqual(
        original.plans.map((p) => [p.createdAt, p.updatedAt, p.archivedAt]),
      );
      expect(copy.workouts.map((w) => [w.startedAt, w.completedAt])).toEqual(
        original.workouts.map((w) => [w.startedAt, w.completedAt]),
      );
    });

    it('restores twice into two independent profiles', async () => {
      const { repos, a, time } = await setup();
      await seed(repos, a, time);
      const original = await repos.backup.exportProfile(a);
      const doc = toDocument(original);
      const first = await repos.backup.restoreAsNewProfile(doc, 'One');
      const second = await repos.backup.restoreAsNewProfile(doc, 'Two');
      expect(first.id).not.toBe(second.id);
      const one = await repos.backup.exportProfile(first.id);
      const two = await repos.backup.exportProfile(second.id);
      expect(normalizeIds({ ...two, profileName: 'One' })).toEqual(normalizeIds(one));
      expect(one.customExercises.map((c) => c.id)).not.toEqual(two.customExercises.map((c) => c.id));

      // Changing one does not change the other or the original.
      await repos.workouts.delete(first.id, one.workouts[0].id);
      await repos.bodyMetrics.delete(first.id, (await repos.bodyMetrics.list(first.id))[0].id);
      await repos.exercises.setExerciseNote(first.id, 'barbell-bench-press', 'x');
      expect(await repos.backup.exportProfile(second.id)).toEqual(two);
      expect(await repos.backup.exportProfile(a)).toEqual(original);
    });

    it('restores the active plan only', async () => {
      const { repos, a, time } = await setup();
      await seed(repos, a, time);
      const doc = toDocument(await repos.backup.exportProfile(a));
      doc.plans[0].active = false;
      doc.plans[1].active = false;
      const none = await repos.backup.restoreAsNewProfile(doc, 'None');
      expect(await repos.plans.getActiveId(none.id)).toBeNull();
      doc.plans[0].active = true;
      const one = await repos.backup.restoreAsNewProfile(doc, 'One');
      const plans = await repos.plans.list(one.id, { includeArchived: true });
      expect(await repos.plans.getActiveId(one.id)).toBe(plans[0].id);
    });

    it('keeps at most one in-progress workout, the most recently started', async () => {
      const { repos, a, time } = await setup();
      await seed(repos, a, time);
      const doc = toDocument(await repos.backup.exportProfile(a));
      const extra = { ...doc.workouts[3], id: 99, name: 'Newer draft', startedAt: '2026-11-06T09:00:00.000Z' };
      doc.workouts.push(extra);
      const restored = await repos.backup.restoreAsNewProfile(doc, 'Copy');
      expect((await repos.workouts.getInProgress(restored.id))?.name).toBe('Newer draft');
      const copy = await repos.backup.exportProfile(restored.id);
      expect(copy.workouts.filter((w) => w.status === 'in_progress')).toHaveLength(1);
      expect(copy.workouts).toHaveLength(4);
    });

    it('restores settings: known valid fields kept, invalid or unknown ones defaulted, onboarding forced', async () => {
      const { repos } = await setup();
      const base = toDocument({
        profileName: 'X',
        settings: {
          language: 'pt-BR',
          theme: 'light',
          onboardingCompleted: false,
          experience: 'beginner',
          defaultRestSeconds: 100,
          restNotifications: 'yes' as never,
          keepAwake: false,
          barKg: 99,
          platesKg: [25, 25],
          lastBackupAt: 42 as never,
          focus: 'hypertrophy' as never,
          e1rmFormula: 'rts',
          effortScale: 7 as never,
          roundingMode: 'ceil' as never,
          somethingNew: 'ignored',
        },
        customExercises: [],
        exerciseSettings: [],
        referenceMaxes: [],
        plans: [],
        workouts: [],
        bodyMetrics: [],
      });
      const restored = await repos.backup.restoreAsNewProfile(base, 'X');
      expect(await repos.settings.get(restored.id)).toEqual({
        profileId: restored.id,
        language: 'pt-BR',
        theme: 'light',
        onboardingCompleted: true,
        experience: 'beginner',
        defaultRestSeconds: 90,
        restNotifications: true,
        keepAwake: false,
        barKg: 20,
        platesKg: [25, 20, 15, 10, 5, 2.5, 1.25],
        lastBackupAt: null,
        focus: 'general',
        e1rmFormula: 'rts',
        effortScale: 'rir',
        roundingMode: 'nearest',
      });

      const empty = await repos.backup.restoreAsNewProfile({ ...base, settings: {} }, 'Y');
      expect(await repos.settings.get(empty.id)).toMatchObject({
        language: 'system',
        theme: 'dark',
        onboardingCompleted: true,
        experience: 'intermediate',
      });
    });

    it('restores sorted plates and a valid last backup time', async () => {
      const { repos } = await setup();
      const doc = toDocument({
        profileName: 'X',
        settings: { platesKg: [5, 20, 0.5], lastBackupAt: '2026-11-20T10:00:00.000Z', barKg: 0, defaultRestSeconds: 0 },
        customExercises: [],
        exerciseSettings: [],
        referenceMaxes: [],
        plans: [],
        workouts: [],
        bodyMetrics: [],
      });
      const restored = await repos.backup.restoreAsNewProfile(doc, 'X');
      expect(await repos.settings.get(restored.id)).toMatchObject({
        platesKg: [20, 5, 0.5],
        lastBackupAt: '2026-11-20T10:00:00.000Z',
        barKg: 0,
        defaultRestSeconds: 0,
      });
    });

    it('unlinks workouts whose plan is not in the backup and keeps unknown exercise ids', async () => {
      const { repos, a, time } = await setup();
      await seed(repos, a, time);
      const doc = toDocument(await repos.backup.exportProfile(a));
      doc.plans = [];
      doc.workouts[1].exercises[0].exerciseId = 'custom-77';
      const restored = await repos.backup.restoreAsNewProfile(doc, 'Copy');
      const copy = await repos.backup.exportProfile(restored.id);
      expect(copy.workouts.map((w) => w.planId)).toEqual([null, null, null, null]);
      expect(copy.workouts[1].exercises[0].exerciseId).toBe('custom-77');
    });

    it('restores an empty backup', async () => {
      const { repos, b } = await setup();
      const doc = toDocument(await repos.backup.exportProfile(b));
      const restored = await repos.backup.restoreAsNewProfile(doc, 'Empty');
      const copy = await repos.backup.exportProfile(restored.id);
      expect(copy).toEqual({ ...(await repos.backup.exportProfile(b)), profileName: 'Empty', settings: { ...copy.settings } });
      expect(copy.settings.onboardingCompleted).toBe(true);
    });

    it('leaves nothing behind when the restore fails', async () => {
      const { repos, a, time } = await setup();
      await seed(repos, a, time);
      const doc = toDocument(await repos.backup.exportProfile(a));
      // An invalid set kind injected past the parser, in the last workout.
      doc.workouts[3].exercises[0].sets[0].kind = 'bogus' as never;
      const profilesBefore = await repos.profiles.list();
      await expect(repos.backup.restoreAsNewProfile(doc, 'Broken')).rejects.toThrow(RangeError);
      expect(await repos.profiles.list()).toEqual(profilesBefore);
      expect(await repos.profiles.getActiveId()).toBe(a);

      // Ids are not consumed by the failed attempt: the next restore starts where it would have.
      doc.workouts[3].exercises[0].sets[0].kind = 'working';
      const ok = await repos.backup.restoreAsNewProfile(doc, 'Fine');
      expect(ok.id).toBe(3);
      const copy = await repos.backup.exportProfile(ok.id);
      expect(copy.customExercises.map((c) => c.id)).toEqual(['custom-3', 'custom-4']);
      expect(copy.plans.map((p) => p.id)).toEqual([3, 4]);
      expect(copy.workouts.map((w) => w.id)).toEqual([5, 6, 7, 8]);
    });

    it('trims nothing and accepts any profile name', async () => {
      const { repos, b } = await setup();
      const doc = toDocument(await repos.backup.exportProfile(b));
      const restored = await repos.backup.restoreAsNewProfile(doc, ' Ana (restored) 2 ');
      expect(restored.name).toBe(' Ana (restored) 2 ');
    });
  });

  describe('backup: v4 content (SPEC-v4 §11.2)', () => {
    /** Seeds profile `a` with reference maxes, a percent plan, a program block, a prescription and RIR 1.5. */
    async function seedStrength(repos: Repositories, a: number) {
      await repos.settings.update(a, {
        focus: 'strength',
        e1rmFormula: 'brzycki',
        effortScale: 'rpe',
        roundingMode: 'down',
        onboardingCompleted: true,
      });
      const box = await repos.exercises.createCustom(a, customInput({ name: 'Box squat' }));
      const pin = await repos.exercises.createCustom(a, customInput({ name: 'Pin press' }));
      expect([box.id, pin.id]).toEqual(['custom-1', 'custom-2']);
      for (const [exerciseId, kg, effectiveAt, origin] of [
        ['barbell-bench-press', 100, '2026-01-10T10:00:00.000Z', 'onboarding'],
        ['barbell-bench-press', 102.5, '2026-02-10T10:00:00.000Z', 'manual'],
        ['barbell-bench-press', 105, '2026-03-10T10:00:00.000Z', 'fromE1rm'],
        ['custom-1', 120, '2026-01-12T10:00:00.000Z', 'manual'],
        ['conventional-deadlift', 180.25, '2025-12-01T10:00:00.000Z', 'v1'],
      ] as const) {
        await repos.referenceMaxes.add(a, { exerciseId, kg, effectiveAt, origin });
      }
      const plan = await repos.plans.create(a, v4PlanContent('custom-1'));
      await repos.plans.setActiveId(a, plan.id);
      const saved = await repos.workouts.saveDraft(
        a,
        draft({
          planId: plan.id,
          planWorkoutId: 'w1',
          name: 'Squat day',
          exercises: [
            entry('barbell-back-squat', [set(105, 5, { rir: 1.5 }), set(117.5, 3, { rir: 0.5 })], {
              planExerciseId: 'p1:0',
              prescription: prescriptionSnapshot('custom-1'),
            }),
            entry('custom-2', [set(60, 8)], { planExerciseId: 'pg2:1' }),
          ],
        }),
      );
      await repos.workouts.complete(a, saved.id, { exercises: saved.exercises, notes: '', completedAt: '2026-11-05T11:00:00.000Z' });
    }

    it('exports reference maxes oldest first, the four settings, and the v4 plan and workout fields', async () => {
      const { repos, a } = await setup();
      await seedStrength(repos, a);
      const data = await repos.backup.exportProfile(a);
      expect(data.referenceMaxes).toEqual([
        { exerciseId: 'conventional-deadlift', kg: 180.25, effectiveAt: '2025-12-01T10:00:00.000Z', origin: 'v1' },
        { exerciseId: 'barbell-bench-press', kg: 100, effectiveAt: '2026-01-10T10:00:00.000Z', origin: 'onboarding' },
        { exerciseId: 'custom-1', kg: 120, effectiveAt: '2026-01-12T10:00:00.000Z', origin: 'manual' },
        { exerciseId: 'barbell-bench-press', kg: 102.5, effectiveAt: '2026-02-10T10:00:00.000Z', origin: 'manual' },
        { exerciseId: 'barbell-bench-press', kg: 105, effectiveAt: '2026-03-10T10:00:00.000Z', origin: 'fromE1rm' },
      ]);
      expect(data.settings).toMatchObject({ focus: 'strength', e1rmFormula: 'brzycki', effortScale: 'rpe', roundingMode: 'down' });
      expect(data.plans[0].content.workouts).toEqual(v4PlanContent('custom-1').workouts);
      expect(data.workouts[0].exercises[0].prescription).toEqual(prescriptionSnapshot('custom-1'));
      expect(data.workouts[0].exercises[0].sets.map((s) => s.rir)).toEqual([1.5, 0.5]);
    });

    it('round trips through restore as a new profile, equal under the id mapping', async () => {
      const { repos, a } = await setup();
      await seedStrength(repos, a);
      const before = await repos.backup.exportProfile(a);

      // Through a serialized document, as a real backup file travels.
      const parsed = parseBackup(serializeBackup(toDocument(before)));
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
      const restored = await repos.backup.restoreAsNewProfile(parsed.backup, 'Ana (restored)');
      const copy = await repos.backup.exportProfile(restored.id);

      expect(normalizeIds({ ...copy, profileName: 'Ana' })).toEqual(normalizeIds(before));
      expect(await repos.settings.get(restored.id)).toMatchObject({
        focus: 'strength',
        e1rmFormula: 'brzycki',
        effortScale: 'rpe',
        roundingMode: 'down',
      });
      expect(await repos.referenceMaxes.list(restored.id)).toHaveLength(5);
      // The original keeps its own records.
      expect(await repos.referenceMaxes.list(a)).toHaveLength(5);
    });

    it('remaps custom exercise ids in reference maxes, percent basis, role mappings and prescription basis', async () => {
      const { repos, a } = await setup();
      await seedStrength(repos, a);
      // A first restore shifts the custom ids (custom-1/2 become custom-3/4) in the next one.
      const first = await repos.backup.restoreAsNewProfile(toDocument(await repos.backup.exportProfile(a)), 'One');
      const second = await repos.backup.restoreAsNewProfile(toDocument(await repos.backup.exportProfile(a)), 'Two');
      const customIds = (await repos.exercises.listCustom(second.id)).map((c) => c.id);
      expect(customIds).toEqual(['custom-5', 'custom-6']);

      const copy = await repos.backup.exportProfile(second.id);
      expect(copy.referenceMaxes.map((m) => m.exerciseId)).toEqual([
        'conventional-deadlift',
        'barbell-bench-press',
        'custom-5',
        'barbell-bench-press',
        'barbell-bench-press',
      ]);
      const workouts = copy.plans[0].content.workouts;
      expect(workouts[0].exercises[0].percent?.basisExerciseId).toBe('custom-5');
      expect(workouts[0].programs?.[1].roles).toEqual({ squat: 'custom-5', bench: 'barbell-bench-press' });
      expect(workouts[1].programs?.[0].roles).toEqual({ lift: 'custom-5' });
      expect(copy.workouts[0].exercises[0].prescription?.basisExerciseId).toBe('custom-5');
      expect(copy.workouts[0].exercises[1].exerciseId).toBe('custom-6');
      // The other restored profile is independent of this one.
      const other = await repos.backup.exportProfile(first.id);
      expect(other.referenceMaxes[2].exerciseId).toBe('custom-3');
    });

    it('the restored custom exercise keeps its reference maxes when deleted from the copy only', async () => {
      const { repos, a } = await setup();
      await seedStrength(repos, a);
      const restored = await repos.backup.restoreAsNewProfile(toDocument(await repos.backup.exportProfile(a)), 'Copy');
      const [box] = await repos.exercises.listCustom(restored.id);
      // The plan still references it, so it cannot be deleted; the original is untouched anyway.
      await expect(repos.exercises.deleteCustom(restored.id, box.id)).rejects.toMatchObject({ code: 'EXERCISE_IN_USE' });
      expect(await repos.referenceMaxes.list(a)).toHaveLength(5);
    });

    it('restores a v3 document (no referenceMaxes, no strength settings, no v4 fields) exactly as before', async () => {
      const { repos, a, time } = await setup();
      await seed(repos, a, time);
      const doc = JSON.parse(serializeBackup(toDocument(await repos.backup.exportProfile(a))));
      delete doc.referenceMaxes;
      for (const key of ['focus', 'e1rmFormula', 'effortScale', 'roundingMode']) delete doc.settings[key];
      const parsed = parseBackup(JSON.stringify(doc));
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
      expect(parsed.backup.referenceMaxes).toEqual([]);

      const restored = await repos.backup.restoreAsNewProfile(parsed.backup, 'v3');
      expect(await repos.referenceMaxes.list(restored.id)).toEqual([]);
      expect(await repos.settings.get(restored.id)).toMatchObject({
        focus: 'general',
        e1rmFormula: 'epley',
        effortScale: 'rir',
        roundingMode: 'nearest',
        experience: 'advanced',
      });
      const copy = await repos.backup.exportProfile(restored.id);
      expect(copy.plans.map((p) => p.content.workouts.map((w) => w.programs))).toEqual([[undefined, undefined], [undefined, undefined]]);
      expect(copy.workouts.flatMap((w) => w.exercises).some((e) => 'prescription' in e)).toBe(false);
    });

    it('leaves nothing behind when a reference max is invalid', async () => {
      const { repos, a } = await setup();
      await seedStrength(repos, a);
      const doc = toDocument(await repos.backup.exportProfile(a));
      doc.referenceMaxes[2].kg = 0;
      const profilesBefore = await repos.profiles.list();
      await expect(repos.backup.restoreAsNewProfile(doc, 'Broken')).rejects.toThrow(RangeError);
      expect(await repos.profiles.list()).toEqual(profilesBefore);
      expect(await repos.referenceMaxes.list(a)).toHaveLength(5);

      // Ids are not consumed by the failed attempt.
      doc.referenceMaxes[2].kg = 120;
      const ok = await repos.backup.restoreAsNewProfile(doc, 'Fine');
      expect(ok.id).toBe(3);
      expect((await repos.exercises.listCustom(ok.id)).map((c) => c.id)).toEqual(['custom-3', 'custom-4']);
      expect((await repos.referenceMaxes.list(ok.id)).map((m) => m.id)).toEqual([6, 7, 8, 9, 10]);
    });

    it('leaves nothing behind when a half-point RIR is off the step', async () => {
      const { repos, a } = await setup();
      await seedStrength(repos, a);
      const doc = toDocument(await repos.backup.exportProfile(a));
      doc.workouts[0].exercises[0].sets[0].rir = 1.25;
      await expect(repos.backup.restoreAsNewProfile(doc, 'Broken')).rejects.toThrow(RangeError);
      expect(await repos.profiles.list()).toHaveLength(2);
      expect(await repos.referenceMaxes.list(3)).toEqual([]);
    });
  });
}
