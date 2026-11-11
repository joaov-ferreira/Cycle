/** Import of percent schemes, program blocks and reference 1RMs (SPEC-v4 §9, IMPORT_FORMAT §2.5–§2.7). */
import { findProgram } from '../library/programs';
import type { Equipment, Exercise } from './exercise';
import { validatePlanContent } from './plan';
import {
  finalizePendingImport,
  finalizeReferenceMaxes,
  parsePlanImport,
  resolveDraft,
  unresolvedReferences,
  type ImportDraft,
  type ImportError,
} from './plan-import';

function ex(id: string, en: string, equipment: Equipment = 'barbell', extra: Partial<Exercise> = {}): Exercise {
  return {
    id,
    name: { en, 'pt-BR': en },
    aliases: [],
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment,
    mechanics: 'compound',
    custom: false,
    archived: false,
    ...extra,
  };
}

const FIXTURE: Exercise[] = [
  ex('barbell-bench-press', 'Bench Press'),
  ex('barbell-back-squat', 'Back Squat'),
  ex('conventional-deadlift', 'Deadlift'),
  ex('leg-curl', 'Leg Curl', 'machine'),
];
const find = (id: string) => FIXTURE.find((e) => e.id === id);
const WITH_PROGRAMS = { findProgram };

function parseOk(text: string, options?: Parameters<typeof parsePlanImport>[2]): ImportDraft {
  const result = parsePlanImport(text, FIXTURE, options);
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.errors)}`);
  return result.draft;
}
function errorsOf(text: string, options?: Parameters<typeof parsePlanImport>[2]): ImportError[] {
  const result = parsePlanImport(text, FIXTURE, options);
  if (result.ok) throw new Error('expected errors');
  return result.errors;
}

const doc = (workout: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ format: 'cycle-plan', version: 1, name: 'P', workouts: [workout], ...extra });
const squat = (percent: unknown, extra: Record<string, unknown> = {}) =>
  doc({ name: 'A', exercises: [{ exercise: 'barbell-back-squat', percent, ...extra }] });
const block = (changes: Record<string, unknown> = {}) => ({
  program: 'cycle-531-custom',
  day: 1,
  roles: { lift: 'barbell-bench-press' },
  ...changes,
});
const blockDoc = (changes: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
  doc({ name: 'A', programs: [block(changes)] }, extra);

describe('JSON percent schemes', () => {
  const FULL = {
    of: 'barbell-back-squat',
    startWeek: 2,
    weeks: [
      [{ sets: 3, reps: 5, percent: 75 }],
      [{ sets: 3, reps: 3, percent: 85 }],
      [
        { sets: 2, reps: 1, percent: 95 },
        { reps: 1, percent: 95, amrap: true, addKg: -2.5 },
      ],
    ],
  };

  it('reads weeks, groups, startWeek and the basis; writes the summary; ignores sets/reps', () => {
    const draft = parseOk(squat(FULL, { rest: 240, sets: 99, reps: 'junk' }));
    const [exercise] = draft.workouts[0].exercises;
    expect(exercise.percent).toEqual({
      startWeek: 2,
      weeks: [
        { sets: [{ reps: 5, percent: 75, repeat: 3 }] },
        { sets: [{ reps: 3, percent: 85, repeat: 3 }] },
        {
          sets: [
            { reps: 1, percent: 95, repeat: 2 },
            { reps: 1, percent: 95, amrap: true, addKg: -2.5 },
          ],
        },
      ],
      of: { reference: 'barbell-back-squat', ref: { status: 'resolved', exerciseId: 'barbell-back-squat' } },
    });
    expect([exercise.sets, exercise.repMin, exercise.repMax]).toEqual([3, 5, 5]);
    expect(exercise.restSeconds).toBe(240);
  });

  it('resolves into PlanContent with basisExerciseId and a valid plan', () => {
    const resolved = resolveDraft(parseOk(squat(FULL)), {});
    if (!resolved.ok) throw new Error('unresolved');
    const content = finalizePendingImport(resolved.pending, {});
    const [exercise] = content.workouts[0].exercises;
    expect(exercise.percent?.basisExerciseId).toBe('barbell-back-squat');
    expect(exercise.percent).not.toHaveProperty('of');
    expect(validatePlanContent(content, find, WITH_PROGRAMS)).toEqual([]);
  });

  it('leaves the basis undefined without `of`', () => {
    const resolved = resolveDraft(parseOk(squat({ weeks: [[{ sets: 3, reps: 5, percent: 70 }]] })), {});
    if (!resolved.ok) throw new Error('unresolved');
    expect(resolved.pending.content.workouts[0].exercises[0].percent).toEqual({
      weeks: [{ sets: [{ reps: 5, percent: 70, repeat: 3 }] }],
    });
  });

  it('accepts an empty week and a group without percent (no load)', () => {
    const draft = parseOk(squat({ weeks: [[{ sets: 3, reps: 5, percent: 70 }], [], [{ reps: 3 }]] }));
    expect(draft.workouts[0].exercises[0].percent?.weeks[1]).toEqual({ sets: [] });
    expect(draft.workouts[0].exercises[0].percent?.weeks[2]).toEqual({ sets: [{ reps: 3 }] });
  });

  it('rejects rir and startLoad with a scheme', () => {
    expect(errorsOf(squat({ weeks: [[{ reps: 5, percent: 70 }]] }, { rir: 2, startLoad: 60 }))).toEqual([
      { code: 'notAllowedWithPercent', path: 'workouts[0].exercises[0].rir' },
      { code: 'notAllowedWithPercent', path: 'workouts[0].exercises[0].startLoad' },
    ]);
  });

  it.each<[string, unknown, ImportError]>([
    ['not an object', 5, { code: 'invalidType', path: 'workouts[0].exercises[0].percent' }],
    ['weeks missing', {}, { code: 'required', path: 'workouts[0].exercises[0].percent.weeks' }],
    ['weeks empty', { weeks: [] }, { code: 'tooShort', path: 'workouts[0].exercises[0].percent.weeks' }],
    ['17 weeks', { weeks: Array.from({ length: 17 }, () => [{ reps: 1, percent: 50 }]) }, { code: 'tooLong', path: 'workouts[0].exercises[0].percent.weeks' }],
    ['week not an array', { weeks: [{}] }, { code: 'invalidType', path: 'workouts[0].exercises[0].percent.weeks[0]' }],
    ['group not an object', { weeks: [[1]] }, { code: 'invalidType', path: 'workouts[0].exercises[0].percent.weeks[0][0]' }],
    ['reps missing', { weeks: [[{ percent: 50 }]] }, { code: 'required', path: 'workouts[0].exercises[0].percent.weeks[0][0].reps' }],
    ['reps not a number', { weeks: [[{ reps: '5', percent: 50 }]] }, { code: 'invalidType', path: 'workouts[0].exercises[0].percent.weeks[0][0].reps' }],
    ['reps zero', { weeks: [[{ reps: 0, percent: 50 }]] }, { code: 'outOfRange', path: 'workouts[0].exercises[0].percent.weeks[0][0].reps' }],
    ['reps fractional', { weeks: [[{ reps: 2.5, percent: 50 }]] }, { code: 'notInteger', path: 'workouts[0].exercises[0].percent.weeks[0][0].reps' }],
    ['percent 121', { weeks: [[{ reps: 1, percent: 121 }]] }, { code: 'outOfRange', path: 'workouts[0].exercises[0].percent.weeks[0][0].percent' }],
    ['percent off step', { weeks: [[{ reps: 1, percent: 72.3 }]] }, { code: 'invalidValue', path: 'workouts[0].exercises[0].percent.weeks[0][0].percent' }],
    ['percent not a number', { weeks: [[{ reps: 1, percent: '70' }]] }, { code: 'invalidType', path: 'workouts[0].exercises[0].percent.weeks[0][0].percent' }],
    ['addKg 3 decimals', { weeks: [[{ reps: 1, percent: 70, addKg: 1.234 }]] }, { code: 'invalidValue', path: 'workouts[0].exercises[0].percent.weeks[0][0].addKg' }],
    ['addKg 101', { weeks: [[{ reps: 1, percent: 70, addKg: 101 }]] }, { code: 'outOfRange', path: 'workouts[0].exercises[0].percent.weeks[0][0].addKg' }],
    ['sets 21', { weeks: [[{ sets: 21, reps: 1, percent: 70 }]] }, { code: 'outOfRange', path: 'workouts[0].exercises[0].percent.weeks[0][0].sets' }],
    ['sets fractional', { weeks: [[{ sets: 1.5, reps: 1, percent: 70 }]] }, { code: 'notInteger', path: 'workouts[0].exercises[0].percent.weeks[0][0].sets' }],
    ['amrap not boolean', { weeks: [[{ reps: 1, percent: 70, amrap: 'yes' }]] }, { code: 'invalidType', path: 'workouts[0].exercises[0].percent.weeks[0][0].amrap' }],
    ['more than 40 sets in a week', { weeks: [[{ sets: 20, reps: 1, percent: 70 }, { sets: 20, reps: 1, percent: 70 }, { sets: 1, reps: 1, percent: 70 }]] }, { code: 'tooLong', path: 'workouts[0].exercises[0].percent.weeks[0]' }],
    ['every week empty', { weeks: [[], []] }, { code: 'emptyScheme', path: 'workouts[0].exercises[0].percent.weeks' }],
    ['startWeek beyond the weeks', { startWeek: 3, weeks: [[{ reps: 1, percent: 70 }]] }, { code: 'outOfRange', path: 'workouts[0].exercises[0].percent.startWeek' }],
    ['startWeek not a number', { startWeek: 'x', weeks: [[{ reps: 1, percent: 70 }]] }, { code: 'invalidType', path: 'workouts[0].exercises[0].percent.startWeek' }],
    ['of blank', { of: ' ', weeks: [[{ reps: 1, percent: 70 }]] }, { code: 'tooShort', path: 'workouts[0].exercises[0].percent.of' }],
  ])('rejects: %s', (_name, percent, error) => {
    expect(errorsOf(squat(percent))).toEqual([error]);
  });

  it('an unresolved basis is listed once and resolved by the user', () => {
    const draft = parseOk(squat({ of: 'Mystery Lift', weeks: [[{ reps: 5, percent: 70 }]] }));
    expect(unresolvedReferences(draft)).toEqual([
      { name: 'Mystery Lift', normalized: 'mystery lift', suggestions: [], count: 1 },
    ]);
    const resolved = resolveDraft(draft, { 'mystery lift': { kind: 'existing', exerciseId: 'barbell-bench-press' } });
    if (!resolved.ok) throw new Error('unresolved');
    expect(resolved.pending.content.workouts[0].exercises[0].percent?.basisExerciseId).toBe('barbell-bench-press');
    expect(resolveDraft(draft, {})).toEqual({ ok: false, unresolved: ['mystery lift'] });
  });

  it('a basis defined in customExercises becomes pending and is finalized', () => {
    const text = JSON.stringify({
      format: 'cycle-plan',
      version: 1,
      name: 'P',
      customExercises: [{ key: 'my-squat', name: 'My squat', primaryMuscle: 'quads', equipment: 'barbell' }],
      workouts: [
        { name: 'A', exercises: [{ exercise: 'barbell-back-squat', percent: { of: 'my-squat', weeks: [[{ reps: 5, percent: 70 }]] } }] },
      ],
    });
    const resolved = resolveDraft(parseOk(text), {});
    if (!resolved.ok) throw new Error('unresolved');
    expect(resolved.pending.customExercises.map((c) => c.key)).toEqual(['my-squat']);
    expect(resolved.pending.content.workouts[0].exercises[0].percent?.basisExerciseId).toBe('pending:my-squat');
    const content = finalizePendingImport(resolved.pending, { 'my-squat': 'custom-9' });
    expect(content.workouts[0].exercises[0].percent?.basisExerciseId).toBe('custom-9');
    expect(() => finalizePendingImport(resolved.pending, {})).toThrow('my-squat');
  });
});

describe('JSON program blocks', () => {
  it('reads a block with defaults', () => {
    const draft = parseOk(blockDoc());
    expect(draft.workouts[0].exercises).toEqual([]);
    expect(draft.workouts[0].programs).toEqual([
      {
        id: 'w1p1',
        programId: 'cycle-531-custom',
        day: 1,
        startWeek: 1,
        accessories: false,
        roles: { lift: { reference: 'barbell-bench-press', ref: { status: 'resolved', exerciseId: 'barbell-bench-press' } } },
      },
    ]);
  });

  it('reads startWeek, accessories and params, and resolves the role mapping', () => {
    const text = blockDoc({ program: 'smolov-jr', day: 2, startWeek: 2, accessories: true, params: { weeklyIncrementKg: 2.5 } });
    const resolved = resolveDraft(parseOk(text, WITH_PROGRAMS), {});
    if (!resolved.ok) throw new Error('unresolved');
    expect(resolved.pending.content.workouts[0].programs).toEqual([
      {
        id: 'w1p1',
        programId: 'smolov-jr',
        day: 2,
        startWeek: 2,
        accessories: true,
        params: { weeklyIncrementKg: 2.5 },
        roles: { lift: 'barbell-bench-press' },
      },
    ]);
    expect(validatePlanContent(resolved.pending.content, find, WITH_PROGRAMS)).toEqual([]);
  });

  it('keeps own exercises next to blocks and accepts an explicit empty exercises list', () => {
    const text = doc({
      name: 'A',
      programs: [block()],
      exercises: [{ exercise: 'leg-curl', sets: 3, reps: '10-15' }],
    });
    expect(parseOk(text).workouts[0].exercises).toHaveLength(1);
    expect(parseOk(doc({ name: 'A', programs: [block()], exercises: [] })).workouts[0].exercises).toEqual([]);
  });

  it('still requires exercises without blocks', () => {
    expect(errorsOf(doc({ name: 'A', exercises: [] }))).toEqual([{ code: 'tooShort', path: 'workouts[0].exercises' }]);
    expect(errorsOf(doc({ name: 'A', programs: [] }))).toEqual([{ code: 'required', path: 'workouts[0].exercises' }]);
  });

  it('rejects more than four blocks', () => {
    expect(
      errorsOf(doc({ name: 'A', programs: [1, 2, 3, 4, 5].map(() => block()) })),
    ).toEqual([{ code: 'tooLong', path: 'workouts[0].programs' }]);
  });

  it('reports a program that is not an array', () => {
    expect(errorsOf(doc({ name: 'A', programs: {} }))).toEqual([
      { code: 'invalidType', path: 'workouts[0].programs' },
      { code: 'required', path: 'workouts[0].exercises' },
    ]);
  });

  const P = 'workouts[0].programs[0]';
  it.each<[string, Record<string, unknown>, ImportError]>([
    ['unknown program', { program: 'nope' }, { code: 'unknownProgram', path: `${P}.program` }],
    ['day beyond the program', { day: 2 }, { code: 'outOfRange', path: `${P}.day` }],
    ['startWeek beyond the program', { startWeek: 4 }, { code: 'outOfRange', path: `${P}.startWeek` }],
    ['unknown role', { roles: { squat: 'barbell-back-squat' } }, { code: 'unknownRole', path: `${P}.roles.squat` }],
    ['unknown param', { params: { nope: 1 } }, { code: 'unknownParam', path: `${P}.params.nope` }],
    ['param out of range', { params: { week1Percent: 2 } }, { code: 'paramOutOfRange', path: `${P}.params.week1Percent` }],
    ['param off step', { params: { week1Percent: 0.7525 } }, { code: 'paramOffStep', path: `${P}.params.week1Percent` }],
  ])('with a program lookup: %s', (_name, changes, error) => {
    expect(errorsOf(blockDoc(changes), WITH_PROGRAMS)).toEqual([error]);
  });

  it.each<[string, Record<string, unknown>, ImportError]>([
    ['program missing', { program: undefined }, { code: 'required', path: `${P}.program` }],
    ['day missing', { day: undefined }, { code: 'required', path: `${P}.day` }],
    ['day zero', { day: 0 }, { code: 'outOfRange', path: `${P}.day` }],
    ['day fractional', { day: 1.5 }, { code: 'notInteger', path: `${P}.day` }],
    ['startWeek zero', { startWeek: 0 }, { code: 'outOfRange', path: `${P}.startWeek` }],
    ['roles missing', { roles: undefined }, { code: 'required', path: `${P}.roles` }],
    ['roles empty', { roles: {} }, { code: 'tooShort', path: `${P}.roles` }],
    ['roles not an object', { roles: [] }, { code: 'invalidType', path: `${P}.roles` }],
    ['role target not text', { roles: { lift: 5 } }, { code: 'invalidType', path: `${P}.roles.lift` }],
    ['role id too long', { roles: { ['r'.repeat(41)]: 'leg-curl' } }, { code: 'invalidValue', path: `${P}.roles.${'r'.repeat(41)}` }],
    ['accessories not boolean', { accessories: 'yes' }, { code: 'invalidType', path: `${P}.accessories` }],
    ['params not an object', { params: 3 }, { code: 'invalidType', path: `${P}.params` }],
    ['param not a number', { params: { a: 'x' } }, { code: 'invalidType', path: `${P}.params.a` }],
  ])('structural check: %s', (_name, changes, error) => {
    expect(errorsOf(blockDoc(changes))).toEqual([error]);
  });

  it('a block that is not an object is rejected', () => {
    expect(errorsOf(doc({ name: 'A', programs: [7] }))).toEqual([{ code: 'invalidType', path: P }]);
  });

  it('without a lookup an unknown program and role are accepted', () => {
    expect(parseOk(blockDoc({ program: 'whatever', day: 9, roles: { x: 'leg-curl' } })).workouts[0].programs).toHaveLength(1);
  });

  it('role targets count as references (unresolved, custom)', () => {
    const draft = parseOk(blockDoc({ roles: { lift: 'Mystery Lift' } }));
    expect(unresolvedReferences(draft)).toEqual([
      { name: 'Mystery Lift', normalized: 'mystery lift', suggestions: [], count: 1 },
    ]);
    const text = blockDoc(
      { roles: { lift: 'my-lift' } },
      { customExercises: [{ key: 'my-lift', name: 'My lift', primaryMuscle: 'quads', equipment: 'barbell' }] },
    );
    const resolved = resolveDraft(parseOk(text), {});
    if (!resolved.ok) throw new Error('unresolved');
    expect(resolved.pending.customExercises.map((c) => c.key)).toEqual(['my-lift']);
    const content = finalizePendingImport(resolved.pending, { 'my-lift': 'custom-3' });
    expect(content.workouts[0].programs?.[0].roles).toEqual({ lift: 'custom-3' });
  });
});

describe('JSON referenceMaxes', () => {
  const maxes = (value: unknown) => blockDoc({}, { referenceMaxes: value });

  it('reads the list; the result carries the resolved exercises', () => {
    const text = maxes([
      { exercise: 'barbell-back-squat', kg: 140 },
      { exercise: 'barbell-bench-press', kg: 100.25 },
    ]);
    const draft = parseOk(text);
    expect(draft.referenceMaxes.map((m) => [m.reference, m.kg])).toEqual([
      ['barbell-back-squat', 140],
      ['barbell-bench-press', 100.25],
    ]);
    const resolved = resolveDraft(draft, {});
    if (!resolved.ok) throw new Error('unresolved');
    expect(resolved.pending.referenceMaxes).toEqual([
      { exerciseId: 'barbell-back-squat', kg: 140 },
      { exerciseId: 'barbell-bench-press', kg: 100.25 },
    ]);
  });

  it('defaults to an empty list, also for plain text', () => {
    expect(parseOk(blockDoc()).referenceMaxes).toEqual([]);
    expect(parseOk('# P\n## A\nBench Press | 3x8').referenceMaxes).toEqual([]);
  });

  it('keeps the last value of an exercise listed twice', () => {
    const draft = parseOk(
      maxes([
        { exercise: 'barbell-back-squat', kg: 130 },
        { exercise: 'Back Squat', kg: 140 },
      ]),
    );
    const resolved = resolveDraft(draft, {});
    if (!resolved.ok) throw new Error('unresolved');
    expect(resolved.pending.referenceMaxes).toEqual([{ exerciseId: 'barbell-back-squat', kg: 140 }]);
  });

  it('unresolved names, custom keys and finalization work like exercise references', () => {
    const text = maxes([{ exercise: 'Zercher Squat', kg: 90 }, { exercise: 'my-lift', kg: 50 }]);
    const withCustom = JSON.parse(text);
    withCustom.customExercises = [{ key: 'my-lift', name: 'My lift', primaryMuscle: 'quads', equipment: 'barbell' }];
    const draft = parseOk(JSON.stringify(withCustom));
    expect(unresolvedReferences(draft).map((u) => u.normalized)).toEqual(['zercher squat']);
    const resolved = resolveDraft(draft, { 'zercher squat': { kind: 'existing', exerciseId: 'leg-curl' } });
    if (!resolved.ok) throw new Error('unresolved');
    expect(resolved.pending.referenceMaxes).toEqual([
      { exerciseId: 'leg-curl', kg: 90 },
      { exerciseId: 'pending:my-lift', kg: 50 },
    ]);
    expect(finalizeReferenceMaxes(resolved.pending, { 'my-lift': 'custom-4' })).toEqual([
      { exerciseId: 'leg-curl', kg: 90 },
      { exerciseId: 'custom-4', kg: 50 },
    ]);
    expect(() => finalizeReferenceMaxes(resolved.pending, {})).toThrow('my-lift');
    expect(finalizeReferenceMaxes({ customExercises: [], content: resolved.pending.content }, {})).toEqual([]);
  });

  it.each<[string, unknown, ImportError]>([
    ['not an array', {}, { code: 'invalidType', path: 'referenceMaxes' }],
    ['entry not an object', [1], { code: 'invalidType', path: 'referenceMaxes[0]' }],
    ['exercise missing', [{ kg: 100 }], { code: 'required', path: 'referenceMaxes[0].exercise' }],
    ['kg missing', [{ exercise: 'leg-curl' }], { code: 'required', path: 'referenceMaxes[0].kg' }],
    ['kg not a number', [{ exercise: 'leg-curl', kg: '100' }], { code: 'invalidType', path: 'referenceMaxes[0].kg' }],
    ['kg zero', [{ exercise: 'leg-curl', kg: 0 }], { code: 'outOfRange', path: 'referenceMaxes[0].kg' }],
    ['kg above 1000', [{ exercise: 'leg-curl', kg: 1001 }], { code: 'outOfRange', path: 'referenceMaxes[0].kg' }],
    ['kg with 3 decimals', [{ exercise: 'leg-curl', kg: 100.123 }], { code: 'invalidValue', path: 'referenceMaxes[0].kg' }],
    ['more than 50', Array.from({ length: 51 }, () => ({ exercise: 'leg-curl', kg: 10 })), { code: 'tooLong', path: 'referenceMaxes' }],
  ])('rejects: %s', (_name, value, error) => {
    expect(errorsOf(maxes(value))).toEqual([error]);
  });
});

describe('text percent lines (SPEC-v4 §9.2)', () => {
  const plan = (...lines: string[]) => ['# P', '## A', ...lines].join('\n');

  it('parses weeks by `/`, groups by `,` and `+` as AMRAP', () => {
    const draft = parseOk(plan('Back Squat 3x5 @75% / 3x3 @85% / 2x1 @95%, 1x1+ @95%'));
    const [exercise] = draft.workouts[0].exercises;
    expect(exercise.ref).toEqual({ status: 'resolved', exerciseId: 'barbell-back-squat' });
    expect(exercise.percent).toEqual({
      weeks: [
        { sets: [{ reps: 5, percent: 75, repeat: 3 }] },
        { sets: [{ reps: 3, percent: 85, repeat: 3 }] },
        { sets: [{ reps: 1, percent: 95, repeat: 2 }, { reps: 1, percent: 95, amrap: true }] },
      ],
    });
    expect([exercise.sets, exercise.repMin, exercise.repMax]).toEqual([3, 5, 5]);
  });

  it('a single week repeats every week', () => {
    const draft = parseOk(plan('Bench Press 5x5 @80%'));
    expect(draft.workouts[0].exercises[0].percent?.weeks).toEqual([{ sets: [{ reps: 5, percent: 80, repeat: 5 }] }]);
  });

  it('accepts decimal percent with `.` or `,`, optional spaces and the × sign', () => {
    const draft = parseOk(plan('Bench Press 3×5 @ 77,5 % / 3x5 @77.5%, 2x3@80%'));
    expect(draft.workouts[0].exercises[0].percent?.weeks).toEqual([
      { sets: [{ reps: 5, percent: 77.5, repeat: 3 }] },
      { sets: [{ reps: 5, percent: 77.5, repeat: 3 }, { reps: 3, percent: 80, repeat: 2 }] },
    ]);
  });

  it('works with a bullet, a superset mark, the pipe form and modifiers', () => {
    const draft = parseOk(
      plan(
        '- Back Squat | 3x5 @75% / 3x3 @85% | rest 240 | warm up well',
        '+ Bench Press 3x5 @70%',
        'Leg Curl | 3x10 | rir 2',
      ),
    );
    const [first, second, third] = draft.workouts[0].exercises;
    expect(first.restSeconds).toBe(240);
    expect(first.note).toBe('warm up well');
    expect(second.supersetGroup).toBe('S1');
    expect(first.supersetGroup).toBe('S1');
    expect(third.percent).toBeUndefined();
    expect(third.targetRir).toBe(2);
  });

  it('a note that mentions a percentage is not a scheme', () => {
    const draft = parseOk(plan('Leg Curl | 3x10 | go for 80% effort @80%'));
    expect(draft.workouts[0].exercises[0].percent).toBeUndefined();
    expect(draft.workouts[0].exercises[0].note).toBe('go for 80% effort @80%');
  });

  it('mixing groups with and without a percentage is mixedPercent', () => {
    expect(errorsOf(plan('Back Squat 3x5 @75%, 1x1'))).toEqual([{ code: 'mixedPercent', line: 3 }]);
    expect(errorsOf(plan('Back Squat 3x5 / 3x3 @85%'))).toEqual([{ code: 'mixedPercent', line: 3 }]);
  });

  it('rir with a scheme is notAllowedWithPercent', () => {
    expect(errorsOf(plan('Back Squat 3x5 @75% | rir 2'))).toEqual([{ code: 'notAllowedWithPercent', line: 3 }]);
  });

  it('scheme limits are reported on the line', () => {
    expect(errorsOf(plan('Back Squat 3x5 @130%'))).toEqual([{ code: 'outOfRange', line: 3 }]);
    expect(errorsOf(plan('Back Squat 3x5 @72.3%'))).toEqual([{ code: 'invalidValue', line: 3 }]);
    expect(errorsOf(plan('Back Squat 25x5 @75%'))).toEqual([{ code: 'outOfRange', line: 3 }]);
  });

  it.each(['Back Squat 3x5 @75% /', 'Back Squat 3x5 @75% 3x3 @80%', 'Back Squat 3x5 @75%,', 'Back Squat 3x5 @75% foo'])(
    'malformed scheme %j is invalidExerciseLine',
    (line) => {
      expect(errorsOf(plan(line))).toEqual([{ code: 'invalidExerciseLine', line: 3 }]);
    },
  );

  it('a scheme produces valid plan content', () => {
    const resolved = resolveDraft(parseOk(plan('Back Squat 3x5 @75% / 3x3 @85%')), {});
    if (!resolved.ok) throw new Error('unresolved');
    expect(validatePlanContent(resolved.pending.content, find)).toEqual([]);
  });
});
