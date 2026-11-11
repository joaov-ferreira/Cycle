import {
  PlanNotFoundError,
  ProfileNotFoundError,
  WorkoutNotFoundError,
  WorkoutStateError,
  type Clock,
  type Repositories,
} from '../repositories';
import { draft, entry, movableClock, planContent, prescriptionSnapshot, set } from './fixtures';

export function describeWorkoutContract(factory: (clock: Clock) => Promise<Repositories>) {
  async function setup() {
    const time = movableClock();
    const repos = await factory(time.clock);
    const a = await repos.profiles.create({ name: 'Ana' });
    const b = await repos.profiles.create({ name: 'Bruno' });
    return { repos, a: a.id, b: b.id, time };
  }

  /** Saves a draft and completes it at `completedAt`. */
  async function completed(
    repos: Repositories,
    profileId: number,
    overrides: Parameters<typeof draft>[0],
    completedAt: string,
  ) {
    const saved = await repos.workouts.saveDraft(profileId, draft(overrides));
    return repos.workouts.complete(profileId, saved.id, {
      exercises: saved.exercises,
      notes: saved.notes,
      completedAt,
    });
  }

  describe('workouts: drafts', () => {
    it('has no in-progress workout at first', async () => {
      const { repos, a } = await setup();
      expect(await repos.workouts.getInProgress(a)).toBeNull();
      expect(await repos.workouts.get(a, 1)).toBeNull();
    });

    it('creates the in-progress workout with its exercises, sets, target and notes', async () => {
      const { repos, a } = await setup();
      const plan = await repos.plans.create(a, planContent());
      const input = draft({
        planId: plan.id,
        planWorkoutId: 'w1',
        name: 'Upper',
        phase: 'deload',
        cycleNumber: 2,
        cycleWeek: 1,
        notes: 'tired',
        exercises: [
          entry(
            'barbell-bench-press',
            [
              set(40, 10, { kind: 'warmup', rir: null }),
              set(60, 8, { rir: 2 }),
              set(60, null, { done: false }),
              set(null, null, { done: false }),
              set(0, 12, { rir: 0 }),
            ],
            {
              planExerciseId: 'e1',
              target: { sets: 3, repMin: 6, repMax: 10, targetRir: 2, restSeconds: 120 },
              note: 'pause on chest',
            },
          ),
          entry('barbell-back-squat', [], { target: { sets: 3, repMin: 5, repMax: 8 } }),
        ],
      });
      const saved = await repos.workouts.saveDraft(a, input);
      expect(saved).toEqual({ ...input, id: 1, profileId: a, status: 'in_progress', completedAt: null });
      expect(await repos.workouts.getInProgress(a)).toEqual(saved);
      expect(await repos.workouts.get(a, saved.id)).toEqual(saved);
    });

    it('overwrites the draft entirely, keeping its id', async () => {
      const { repos, a } = await setup();
      const first = await repos.workouts.saveDraft(
        a,
        draft({
          name: 'First',
          notes: 'x',
          exercises: [
            entry('barbell-bench-press', [set(60, 8), set(60, 7)], { note: 'old' }),
            entry('leg-press', [set(100, 10)]),
          ],
        }),
      );
      const plan = await repos.plans.create(a, planContent());
      const input = draft({
        name: 'Second',
        planId: plan.id,
        planWorkoutId: 'w2',
        phase: 'deload',
        cycleNumber: 3,
        cycleWeek: 2,
        startedAt: '2026-11-05T09:30:00.000Z',
        notes: '',
        exercises: [entry('barbell-back-squat', [set(100, 5)])],
      });
      const second = await repos.workouts.saveDraft(a, input);
      expect(second).toEqual({ ...input, id: first.id, profileId: a, status: 'in_progress', completedAt: null });
      expect(await repos.workouts.getInProgress(a)).toEqual(second);
      expect(await repos.workouts.listCompleted(a)).toEqual([]);
    });

    it('allows at most one in-progress workout per profile', async () => {
      const { repos, a, b } = await setup();
      const first = await repos.workouts.saveDraft(a, draft());
      const second = await repos.workouts.saveDraft(a, draft({ name: 'Again' }));
      expect(second.id).toBe(first.id);
      const other = await repos.workouts.saveDraft(b, draft({ name: 'Bruno' }));
      expect(other.id).not.toBe(first.id);
      expect((await repos.workouts.getInProgress(a))?.name).toBe('Again');
      expect((await repos.workouts.getInProgress(b))?.name).toBe('Bruno');
    });

    it('starts a new draft with a new id once the previous one is completed', async () => {
      const { repos, a } = await setup();
      const first = await completed(repos, a, {}, '2026-11-05T11:00:00.000Z');
      const next = await repos.workouts.saveDraft(a, draft());
      expect(next.id).not.toBe(first.id);
      expect(await repos.workouts.get(a, first.id)).toEqual(first);
    });

    it('returns copies, so callers cannot mutate stored data', async () => {
      const { repos, a } = await setup();
      const saved = await repos.workouts.saveDraft(
        a,
        draft({ exercises: [entry('barbell-bench-press', [set(60, 8)], { target: { sets: 3, repMin: 6, repMax: 10 } })] }),
      );
      saved.exercises[0].sets[0].weightKg = 999;
      saved.exercises[0].target = null;
      saved.exercises.push(entry('x', []));
      const stored = await repos.workouts.getInProgress(a);
      expect(stored?.exercises).toHaveLength(1);
      expect(stored?.exercises[0].sets[0].weightKg).toBe(60);
      expect(stored?.exercises[0].target).toEqual({ sets: 3, repMin: 6, repMax: 10 });
    });

    it('rejects an unknown kind and out-of-range set values with RangeError, changing nothing', async () => {
      const { repos, a } = await setup();
      const saved = await repos.workouts.saveDraft(a, draft());
      const bad = [
        set(60, 8, { kind: 'dropset' as never }),
        set(-1, 8),
        set(1000.5, 8),
        set(60, 0),
        set(60, 101),
        set(60, 2.5),
        set(60, 8, { rir: 11 }),
        set(60, 8, { rir: -1 }),
        set(60, 8, { rir: 1.25 }),
        set(60, 8, { rir: 10.5 }),
        set(NaN, 8),
      ];
      for (const s of bad) {
        await expect(
          repos.workouts.saveDraft(a, draft({ exercises: [entry('barbell-bench-press', [s])] })),
        ).rejects.toThrow(RangeError);
        await expect(
          repos.workouts.complete(a, saved.id, { exercises: [entry('barbell-bench-press', [s])], notes: '' }),
        ).rejects.toThrow(RangeError);
      }
      expect(await repos.workouts.getInProgress(a)).toEqual(saved);
    });

    it('accepts the limits of set values', async () => {
      const { repos, a } = await setup();
      const sets = [set(0, 1, { rir: 0 }), set(1000, 100, { rir: 10 }), set(82.5, 5, { kind: 'warmup' })];
      const saved = await repos.workouts.saveDraft(a, draft({ exercises: [entry('x', sets)] }));
      expect(saved.exercises[0].sets).toEqual(sets);
    });

    it('rejects a plan that does not exist for the profile', async () => {
      const { repos, a, b } = await setup();
      const foreign = await repos.plans.create(b, planContent());
      await expect(repos.workouts.saveDraft(a, draft({ planId: 99 }))).rejects.toThrow(PlanNotFoundError);
      await expect(repos.workouts.saveDraft(a, draft({ planId: foreign.id }))).rejects.toThrow(PlanNotFoundError);
      expect(await repos.workouts.getInProgress(a)).toBeNull();
    });

    it('accepts an archived plan', async () => {
      const { repos, a } = await setup();
      const plan = await repos.plans.create(a, planContent());
      await repos.plans.setArchived(a, plan.id, true);
      expect((await repos.workouts.saveDraft(a, draft({ planId: plan.id }))).planId).toBe(plan.id);
    });

    it('throws ProfileNotFoundError for an unknown profile', async () => {
      const { repos } = await setup();
      await expect(repos.workouts.saveDraft(99, draft())).rejects.toThrow(ProfileNotFoundError);
    });
  });

  describe('workouts: complete, amend, delete', () => {
    it('completes the draft with the clock time by default', async () => {
      const { repos, a, time } = await setup();
      const saved = await repos.workouts.saveDraft(a, draft({ notes: 'before' }));
      time.set('2026-11-05T11:15:00.000Z');
      const exercises = [entry('barbell-bench-press', [set(62.5, 8, { rir: 1 }), set(62.5, 7, { rir: 0 })])];
      const done = await repos.workouts.complete(a, saved.id, { exercises, notes: 'after' });
      expect(done).toEqual({
        ...saved,
        status: 'completed',
        completedAt: '2026-11-05T11:15:00.000Z',
        notes: 'after',
        exercises,
      });
      expect(await repos.workouts.get(a, saved.id)).toEqual(done);
      expect(await repos.workouts.getInProgress(a)).toBeNull();
    });

    it('completes with an explicit completion time', async () => {
      const { repos, a } = await setup();
      const saved = await repos.workouts.saveDraft(a, draft());
      const done = await repos.workouts.complete(a, saved.id, {
        exercises: saved.exercises,
        notes: '',
        completedAt: '2026-11-05T12:00:00.000Z',
      });
      expect(done.completedAt).toBe('2026-11-05T12:00:00.000Z');
    });

    it('refuses to complete a completed workout, an unknown workout or another profile\'s', async () => {
      const { repos, a, b } = await setup();
      const done = await completed(repos, a, {}, '2026-11-05T11:00:00.000Z');
      await expect(
        repos.workouts.complete(a, done.id, { exercises: [], notes: '' }),
      ).rejects.toThrow(WorkoutStateError);
      await expect(repos.workouts.complete(a, done.id, { exercises: [], notes: '' })).rejects.toMatchObject({
        code: 'WORKOUT_STATE',
        workoutId: done.id,
      });
      await expect(repos.workouts.complete(a, 99, { exercises: [], notes: '' })).rejects.toThrow(WorkoutNotFoundError);
      const live = await repos.workouts.saveDraft(a, draft());
      await expect(
        repos.workouts.complete(b, live.id, { exercises: [], notes: '' }),
      ).rejects.toMatchObject({ code: 'WORKOUT_NOT_FOUND', workoutId: live.id });
      expect(await repos.workouts.getInProgress(a)).toEqual(live);
    });

    it('amends a completed workout, keeping dates, phase, plan and cycle fields', async () => {
      const { repos, a } = await setup();
      const plan = await repos.plans.create(a, planContent());
      const done = await completed(
        repos,
        a,
        { planId: plan.id, planWorkoutId: 'w1', name: 'Upper', phase: 'deload', cycleNumber: 2, cycleWeek: 1 },
        '2026-11-05T11:00:00.000Z',
      );
      const exercises = [entry('barbell-bench-press', [set(65, 6)]), entry('leg-press', [set(120, 12)])];
      const amended = await repos.workouts.amend(a, done.id, { exercises, notes: 'fixed typo' });
      expect(amended).toEqual({ ...done, exercises, notes: 'fixed typo' });
      expect(await repos.workouts.get(a, done.id)).toEqual(amended);
    });

    it('refuses to amend a draft, an unknown workout or another profile\'s', async () => {
      const { repos, a, b } = await setup();
      const live = await repos.workouts.saveDraft(a, draft());
      await expect(repos.workouts.amend(a, live.id, { exercises: [], notes: '' })).rejects.toThrow(WorkoutStateError);
      await expect(repos.workouts.amend(a, 99, { exercises: [], notes: '' })).rejects.toThrow(WorkoutNotFoundError);
      const done = await completed(repos, a, {}, '2026-11-05T11:00:00.000Z');
      await expect(repos.workouts.amend(b, done.id, { exercises: [], notes: '' })).rejects.toThrow(WorkoutNotFoundError);
      await expect(
        repos.workouts.amend(a, done.id, { exercises: [entry('x', [set(1, 0)])], notes: '' }),
      ).rejects.toThrow(RangeError);
      expect(await repos.workouts.get(a, done.id)).toEqual(done);
    });

    it('deletes completed and in-progress workouts', async () => {
      const { repos, a } = await setup();
      const done = await completed(repos, a, {}, '2026-11-05T11:00:00.000Z');
      const live = await repos.workouts.saveDraft(a, draft());
      await repos.workouts.delete(a, done.id);
      expect(await repos.workouts.get(a, done.id)).toBeNull();
      expect(await repos.workouts.listCompleted(a)).toEqual([]);
      await repos.workouts.delete(a, live.id);
      expect(await repos.workouts.getInProgress(a)).toBeNull();
      expect((await repos.workouts.saveDraft(a, draft())).id).not.toBe(live.id);
    });

    it('throws WorkoutNotFoundError when deleting an unknown or foreign workout', async () => {
      const { repos, a, b } = await setup();
      const done = await completed(repos, a, {}, '2026-11-05T11:00:00.000Z');
      await expect(repos.workouts.delete(a, 99)).rejects.toThrow(WorkoutNotFoundError);
      await expect(repos.workouts.delete(b, done.id)).rejects.toThrow(WorkoutNotFoundError);
      expect(await repos.workouts.get(a, done.id)).toEqual(done);
      expect(await repos.workouts.get(b, done.id)).toBeNull();
    });
  });

  describe('workouts: supersets, drop sets and target RIR', () => {
    const superset = () => [
      entry('barbell-bench-press', [set(60, 8), set(60, 7)], { supersetGroup: 'A' }),
      entry('seated-cable-row', [set(50, 10), set(50, 9)], { supersetGroup: 'A' }),
      entry('barbell-back-squat', [set(90, 5)]),
    ];

    it('round trips the superset group through draft, complete and amend', async () => {
      const { repos, a } = await setup();
      const saved = await repos.workouts.saveDraft(a, draft({ exercises: superset() }));
      expect(saved.exercises.map((e) => e.supersetGroup)).toEqual(['A', 'A', null]);
      expect((await repos.workouts.getInProgress(a))?.exercises.map((e) => e.supersetGroup)).toEqual(['A', 'A', null]);

      const done = await repos.workouts.complete(a, saved.id, { exercises: superset(), notes: '' });
      expect(done.exercises.map((e) => e.supersetGroup)).toEqual(['A', 'A', null]);

      const regrouped = [
        entry('barbell-bench-press', [set(60, 8)], { supersetGroup: null }),
        entry('seated-cable-row', [set(50, 10)], { supersetGroup: 'B2' }),
        entry('barbell-back-squat', [set(90, 5)], { supersetGroup: 'B2' }),
      ];
      const amended = await repos.workouts.amend(a, done.id, { exercises: regrouped, notes: '' });
      expect(amended.exercises.map((e) => e.supersetGroup)).toEqual([null, 'B2', 'B2']);
      expect((await repos.workouts.get(a, done.id))?.exercises.map((e) => e.supersetGroup)).toEqual([null, 'B2', 'B2']);
      expect((await repos.workouts.listCompleted(a))[0].exercises.map((e) => e.supersetGroup)).toEqual([null, 'B2', 'B2']);
    });

    it('returns a null superset group for entries saved without one', async () => {
      const { repos, a } = await setup();
      const withoutField = { ...entry('barbell-bench-press', [set(60, 8)]) };
      delete withoutField.supersetGroup;
      const saved = await repos.workouts.saveDraft(a, draft({ exercises: [withoutField] }));
      expect(saved.exercises[0].supersetGroup).toBeNull();
      expect((await repos.workouts.get(a, saved.id))?.exercises[0].supersetGroup).toBeNull();
    });

    it('accepts drop sets wherever working and warm-up sets are accepted', async () => {
      const { repos, a } = await setup();
      const sets = [set(40, 10, { kind: 'warmup' }), set(80, 8), set(64, 8, { kind: 'drop' }), set(50, 10, { kind: 'drop', rir: 0 })];
      const saved = await repos.workouts.saveDraft(a, draft({ exercises: [entry('barbell-bench-press', sets)] }));
      expect(saved.exercises[0].sets).toEqual(sets);
      const done = await repos.workouts.complete(a, saved.id, {
        exercises: [entry('barbell-bench-press', sets)],
        notes: '',
        completedAt: '2026-11-05T11:00:00.000Z',
      });
      expect(done.exercises[0].sets).toEqual(sets);
      const amendedSets = [set(80, 8), set(60, 8, { kind: 'drop' })];
      const amended = await repos.workouts.amend(a, done.id, {
        exercises: [entry('barbell-bench-press', amendedSets)],
        notes: '',
      });
      expect(amended.exercises[0].sets).toEqual(amendedSets);
      expect((await repos.workouts.exerciseSessions(a, 'barbell-bench-press'))[0].sets).toEqual(amendedSets);
    });

    it('still rejects unknown set kinds', async () => {
      const { repos, a } = await setup();
      await expect(
        repos.workouts.saveDraft(a, draft({ exercises: [entry('x', [set(60, 8, { kind: 'drops' as never })])] })),
      ).rejects.toThrow(RangeError);
    });

    it('reports the target RIR of the snapshot in exercise sessions, null without one', async () => {
      const { repos, a } = await setup();
      await completed(
        repos,
        a,
        { exercises: [entry('barbell-bench-press', [set(60, 8)], { target: { sets: 3, repMin: 6, repMax: 10, targetRir: 2 } })] },
        '2026-11-01T10:00:00.000Z',
      );
      await completed(
        repos,
        a,
        { exercises: [entry('barbell-bench-press', [set(60, 8)], { target: { sets: 3, repMin: 6, repMax: 10 } })] },
        '2026-11-02T10:00:00.000Z',
      );
      await completed(repos, a, { exercises: [entry('barbell-bench-press', [set(60, 8)])] }, '2026-11-03T10:00:00.000Z');
      await completed(
        repos,
        a,
        { exercises: [entry('barbell-bench-press', [set(60, 8)], { target: { sets: 3, repMin: 6, repMax: 10, targetRir: 0 } })] },
        '2026-11-04T10:00:00.000Z',
      );
      const sessions = await repos.workouts.exerciseSessions(a, 'barbell-bench-press');
      expect(sessions.map((s) => s.targetRir)).toEqual([0, null, null, 2]);
    });
  });

  describe('workouts: queries', () => {
    it('lists completed workouts newest completion first, without drafts', async () => {
      const { repos, a } = await setup();
      const w1 = await completed(repos, a, { name: 'One' }, '2026-11-01T10:00:00.000Z');
      const w3 = await completed(repos, a, { name: 'Three' }, '2026-11-03T10:00:00.000Z');
      const w2 = await completed(repos, a, { name: 'Two' }, '2026-11-02T10:00:00.000Z');
      await repos.workouts.saveDraft(a, draft({ name: 'Draft' }));
      expect(await repos.workouts.listCompleted(a)).toEqual([w3, w2, w1]);
    });

    it('breaks completion-time ties by newest id first', async () => {
      const { repos, a } = await setup();
      const first = await completed(repos, a, { name: 'First' }, '2026-11-01T10:00:00.000Z');
      const second = await completed(repos, a, { name: 'Second' }, '2026-11-01T10:00:00.000Z');
      expect((await repos.workouts.listCompleted(a)).map((w) => w.id)).toEqual([second.id, first.id]);
    });

    it('filters by plan and by exercise, alone or together', async () => {
      const { repos, a } = await setup();
      const planA = await repos.plans.create(a, planContent());
      const planB = await repos.plans.create(a, planContent());
      const bench = entry('barbell-bench-press', [set(60, 8)]);
      const squat = entry('barbell-back-squat', [set(100, 5)]);
      const w1 = await completed(repos, a, { planId: planA.id, exercises: [bench] }, '2026-11-01T10:00:00.000Z');
      const w2 = await completed(repos, a, { planId: planA.id, exercises: [squat] }, '2026-11-02T10:00:00.000Z');
      const w3 = await completed(repos, a, { planId: planB.id, exercises: [bench, squat] }, '2026-11-03T10:00:00.000Z');
      const w4 = await completed(repos, a, { planId: null, exercises: [bench] }, '2026-11-04T10:00:00.000Z');
      const ids = async (filter: { planId?: number; exerciseId?: string }) =>
        (await repos.workouts.listCompleted(a, filter)).map((w) => w.id);
      expect(await ids({})).toEqual([w4.id, w3.id, w2.id, w1.id]);
      expect(await ids({ planId: planA.id })).toEqual([w2.id, w1.id]);
      expect(await ids({ planId: planB.id })).toEqual([w3.id]);
      expect(await ids({ exerciseId: 'barbell-bench-press' })).toEqual([w4.id, w3.id, w1.id]);
      expect(await ids({ exerciseId: 'barbell-back-squat' })).toEqual([w3.id, w2.id]);
      expect(await ids({ planId: planB.id, exerciseId: 'barbell-bench-press' })).toEqual([w3.id]);
      expect(await ids({ planId: planA.id, exerciseId: 'leg-press' })).toEqual([]);
      expect(await ids({ exerciseId: 'unknown' })).toEqual([]);
    });

    it('scopes listings to the profile', async () => {
      const { repos, a, b } = await setup();
      await completed(repos, a, {}, '2026-11-01T10:00:00.000Z');
      expect(await repos.workouts.listCompleted(b)).toEqual([]);
      expect(await repos.workouts.exerciseSessions(b, 'barbell-bench-press')).toEqual([]);
    });

    it('lists the sessions of an exercise, newest first, with the fields progression reads', async () => {
      const { repos, a } = await setup();
      const plan = await repos.plans.create(a, planContent());
      const old = await completed(
        repos,
        a,
        { planId: plan.id, phase: 'load', cycleNumber: 1, cycleWeek: 2, exercises: [entry('barbell-bench-press', [set(60, 8, { rir: 2 })])] },
        '2026-11-01T10:00:00.000Z',
      );
      await completed(
        repos,
        a,
        { exercises: [entry('barbell-back-squat', [set(100, 5)])] },
        '2026-11-02T10:00:00.000Z',
      );
      const recent = await completed(
        repos,
        a,
        {
          planId: null,
          phase: 'deload',
          cycleNumber: null,
          cycleWeek: null,
          exercises: [
            entry('barbell-bench-press', [set(40, 10, { kind: 'warmup' }), set(55, 8)]),
            entry('barbell-back-squat', [set(90, 5)]),
            entry('barbell-bench-press', [set(50, 6, { done: false })]),
          ],
        },
        '2026-11-03T10:00:00.000Z',
      );
      await repos.workouts.saveDraft(a, draft({ exercises: [entry('barbell-bench-press', [set(70, 5)])] }));

      expect(await repos.workouts.exerciseSessions(a, 'barbell-bench-press')).toEqual([
        {
          workoutId: recent.id,
          completedAt: '2026-11-03T10:00:00.000Z',
          phase: 'deload',
          cycleNumber: null,
          planId: null,
          targetRir: null,
          sets: [set(40, 10, { kind: 'warmup' }), set(55, 8), set(50, 6, { done: false })],
        },
        {
          workoutId: old.id,
          completedAt: '2026-11-01T10:00:00.000Z',
          phase: 'load',
          cycleNumber: 1,
          planId: plan.id,
          targetRir: null,
          sets: [set(60, 8, { rir: 2 })],
        },
      ]);
    });

    it('limits the sessions to the newest ones', async () => {
      const { repos, a } = await setup();
      for (const day of ['01', '02', '03', '04']) {
        await completed(repos, a, {}, `2026-11-${day}T10:00:00.000Z`);
      }
      const sessions = await repos.workouts.exerciseSessions(a, 'barbell-bench-press', { limit: 2 });
      expect(sessions.map((s) => s.completedAt)).toEqual(['2026-11-04T10:00:00.000Z', '2026-11-03T10:00:00.000Z']);
      expect(await repos.workouts.exerciseSessions(a, 'barbell-bench-press', { limit: 10 })).toHaveLength(4);
      expect(await repos.workouts.exerciseSessions(a, 'barbell-bench-press', {})).toHaveLength(4);
      expect(await repos.workouts.exerciseSessions(a, 'barbell-bench-press', { limit: 0 })).toEqual([]);
    });

    it('reports a deleted plan as planId null in sessions', async () => {
      const { repos, a } = await setup();
      const plan = await repos.plans.create(a, planContent());
      await completed(repos, a, { planId: plan.id }, '2026-11-01T10:00:00.000Z');
      await repos.plans.delete(a, plan.id);
      expect((await repos.workouts.exerciseSessions(a, 'barbell-bench-press'))[0].planId).toBeNull();
    });
  });

  describe('workouts: v4 prescriptions and half-point RIR', () => {
    const withPrescription = () => [
      entry('barbell-back-squat', [set(105, 5, { rir: 1.5 }), set(117.5, 3, { rir: 0.5 })], {
        planExerciseId: 'p1:0',
        target: { sets: 3, repMin: 3, repMax: 5 },
        prescription: prescriptionSnapshot(),
      }),
      entry('seated-cable-row', [set(50, 10)], { planExerciseId: 'pg1:2' }),
    ];

    it('round trips the prescription snapshot, planExerciseId and half-point RIR through draft, complete and amend', async () => {
      const { repos, a } = await setup();
      const saved = await repos.workouts.saveDraft(a, draft({ exercises: withPrescription() }));
      expect(saved.exercises[0].prescription).toEqual(prescriptionSnapshot());
      expect(saved.exercises[0].planExerciseId).toBe('p1:0');
      expect(saved.exercises[1].planExerciseId).toBe('pg1:2');
      expect(saved.exercises[0].sets.map((s) => s.rir)).toEqual([1.5, 0.5]);
      expect((await repos.workouts.getInProgress(a))?.exercises).toEqual(saved.exercises);

      const done = await repos.workouts.complete(a, saved.id, { exercises: withPrescription(), notes: '' });
      expect(done.exercises).toEqual(saved.exercises);
      expect((await repos.workouts.get(a, done.id))?.exercises[0].prescription?.source).toEqual({
        kind: 'program',
        programId: 'smolov-jr',
        programWeek: 2,
        day: 1,
        label: { en: 'Heavy day', 'pt-BR': 'Dia pesado' },
      });

      const edited = withPrescription();
      edited[0].sets[0].rir = 2.5;
      const amended = await repos.workouts.amend(a, done.id, { exercises: edited, notes: 'x' });
      expect(amended.exercises[0].sets[0].rir).toBe(2.5);
      expect(amended.exercises[0].prescription).toEqual(prescriptionSnapshot());
      expect((await repos.workouts.listCompleted(a))[0].exercises[0].prescription).toEqual(prescriptionSnapshot());
    });

    it('round trips a scheme source and a missing basis', async () => {
      const { repos, a } = await setup();
      const snapshot = {
        ...prescriptionSnapshot(),
        basisKg: null,
        source: { kind: 'scheme' as const, schemeWeek: 3 },
        warnings: ['missingReferenceMax' as const],
      };
      const saved = await repos.workouts.saveDraft(
        a,
        draft({ exercises: [entry('barbell-back-squat', [set(1, 1)], { prescription: snapshot })] }),
      );
      expect(saved.exercises[0].prescription).toEqual(snapshot);
    });

    it('returns entries without a prescription as absent, whether saved without one or with null', async () => {
      const { repos, a } = await setup();
      const plain = await repos.workouts.saveDraft(a, draft({ exercises: [entry('barbell-back-squat', [set(100, 5)])] }));
      expect(plain.exercises[0]).not.toHaveProperty('prescription');
      const nulled = await repos.workouts.saveDraft(
        a,
        draft({ exercises: [entry('barbell-back-squat', [set(100, 5)], { prescription: null })] }),
      );
      expect(nulled.exercises[0]).not.toHaveProperty('prescription');
      expect((await repos.workouts.get(a, nulled.id))?.exercises[0]).not.toHaveProperty('prescription');
    });

    it('accepts every half point of RIR from 0 to 10 and rejects other fractions', async () => {
      const { repos, a } = await setup();
      const halves = Array.from({ length: 21 }, (_, i) => i / 2);
      const saved = await repos.workouts.saveDraft(
        a,
        draft({ exercises: [entry('barbell-bench-press', halves.map((rir) => set(60, 8, { rir })))] }),
      );
      expect(saved.exercises[0].sets.map((s) => s.rir)).toEqual(halves);
      expect((await repos.workouts.get(a, saved.id))?.exercises[0].sets.map((s) => s.rir)).toEqual(halves);
      for (const rir of [0.25, 1.1, 10.5, -0.5]) {
        await expect(
          repos.workouts.saveDraft(a, draft({ exercises: [entry('barbell-bench-press', [set(60, 8, { rir })])] })),
        ).rejects.toThrow(RangeError);
      }
    });

    it('reports half-point RIR in exercise sessions', async () => {
      const { repos, a } = await setup();
      await completed(
        repos,
        a,
        { exercises: [entry('barbell-bench-press', [set(60, 8, { rir: 1.5 })])] },
        '2026-11-01T10:00:00.000Z',
      );
      expect((await repos.workouts.exerciseSessions(a, 'barbell-bench-press'))[0].sets[0].rir).toBe(1.5);
    });

    it('blocks deleting a custom exercise used as a prescription basis', async () => {
      const { repos, a } = await setup();
      const custom = await repos.exercises.createCustom(a, {
        name: 'Box squat',
        primaryMuscle: 'quads',
        secondaryMuscles: [],
        equipment: 'barbell',
        mechanics: 'compound',
      });
      await repos.workouts.saveDraft(
        a,
        draft({
          exercises: [entry('barbell-back-squat', [set(100, 5)], { prescription: prescriptionSnapshot(custom.id) })],
        }),
      );
      expect(await repos.exercises.isReferenced(a, custom.id)).toBe(true);
      await expect(repos.exercises.deleteCustom(a, custom.id)).rejects.toMatchObject({ code: 'EXERCISE_IN_USE' });
    });
  });
}
