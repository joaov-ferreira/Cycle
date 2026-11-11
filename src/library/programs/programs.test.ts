import { expandProgramDay, isRestDay, validateProgram, type ProgramLink, type ProgramTemplate } from '../../domain/program';
import { findExercise } from '../exercises';
import { PROGRAMS, findProgram, programsByFamily } from './index';

const exists = (id: string) => findExercise(id) !== undefined;
const get = (id: string): ProgramTemplate => {
  const template = findProgram(id);
  if (!template) throw new Error(`missing template ${id}`);
  return template;
};
const link = (programId: string, over: Partial<ProgramLink> = {}): ProgramLink => ({
  id: 'l1',
  programId,
  day: 1,
  startWeek: 1,
  roles: {},
  accessories: false,
  ...over,
});

describe('program registry', () => {
  it('lists the eight templates in display order with unique ids', () => {
    expect(PROGRAMS.map((p) => p.id)).toEqual([
      'cycle-531-custom',
      'smolov-jr',
      'smolov',
      'sheiko-29',
      'sheiko-30',
      'sheiko-31',
      'sheiko-32',
      'sheiko-37',
    ]);
  });

  it('finds a template by id', () => {
    expect(findProgram('smolov')?.name).toBe('Smolov');
    expect(findProgram('nope')).toBeUndefined();
  });

  it('groups templates by family in order of first appearance', () => {
    expect(programsByFamily().map((g) => [g.family, g.programs.map((p) => p.id)])).toEqual([
      ['531-custom', ['cycle-531-custom']],
      ['smolov-jr', ['smolov-jr']],
      ['smolov', ['smolov']],
      ['sheiko', ['sheiko-29', 'sheiko-30', 'sheiko-31', 'sheiko-32', 'sheiko-37']],
    ]);
  });
});

describe('program data (SPEC-v4 §4)', () => {
  it.each(PROGRAMS.map((p) => p.id))('%s passes validateProgram against the real library', (id) => {
    expect(validateProgram(get(id), exists)).toEqual([]);
  });

  it('declares the roles of SPEC-v4 §4.2', () => {
    const roles = (id: string) => get(id).roles;
    expect(roles('cycle-531-custom')).toEqual([{ id: 'lift', label: expect.anything() }]);
    expect(roles('smolov-jr').map((r) => r.id)).toEqual(['lift']);
    expect(roles('smolov')).toEqual([
      expect.objectContaining({ id: 'squat', defaultExerciseId: 'barbell-back-squat', fixedInOriginal: true }),
    ]);
    for (const id of ['sheiko-29', 'sheiko-30', 'sheiko-31', 'sheiko-32', 'sheiko-37']) {
      expect(roles(id).map((r) => [r.id, r.defaultExerciseId, r.fixedInOriginal])).toEqual([
        ['bench', 'barbell-bench-press', undefined],
        ['squat', 'barbell-back-squat', undefined],
        ['deadlift', 'conventional-deadlift', undefined],
      ]);
    }
  });

  it('keeps source, version and verification on every template', () => {
    for (const template of PROGRAMS) {
      expect(template.source.author).not.toBe('');
      expect(template.source.accessedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(template.version).not.toBe('');
      expect(['verified', 'partial', 'unverified']).toContain(template.verification);
    }
  });

  it('has Sheiko variations pointing at library exercises, percentages still on the role', () => {
    const variations = new Set<string>();
    for (const id of ['sheiko-29', 'sheiko-30', 'sheiko-31', 'sheiko-32', 'sheiko-37']) {
      for (const week of get(id).weeks) {
        for (const day of week.days) {
          for (const item of day.items) {
            if (item.kind === 'main' && item.variation) variations.add(`${item.variation.name.en}=${item.variation.exerciseId}`);
          }
        }
      }
    }
    expect([...variations].sort()).toEqual([
      'Deadlift from boxes=deadlift-from-boxes',
      'Deadlift up to knees=deadlift-to-knees',
      'Deficit deadlift=deficit-deadlift',
      'Front squat=barbell-front-squat',
    ]);
  });
});

describe('Smolov info items', () => {
  it('give the tests and the switching phase the squat role and leave the rest days without one', () => {
    const infos: [string, string | undefined][] = [];
    for (const week of get('smolov').weeks) {
      for (const day of week.days) {
        for (const item of day.items) if (item.kind === 'info') infos.push([item.text.en.split(':')[0], item.role]);
      }
    }
    const byText = new Map<string, Set<string | undefined>>();
    for (const [text, role] of infos) byText.set(text, (byText.get(text) ?? new Set()).add(role));
    expect([...byText].map(([text, roles]) => [text, [...roles]])).toEqual([
      ['Rest day', [undefined]],
      ['1RM test', ['squat']],
      ['Switching phase', ['squat']],
    ]);
  });
});

describe('sanity values of SPEC-v4 §4.2', () => {
  it('Smolov Jr. week 1: 6x6 @70, 7x5 @75, 8x4 @80, 10x3 @85', () => {
    const template = get('smolov-jr');
    const roles = { lift: 'barbell-back-squat' };
    const days = [1, 2, 3, 4].map((day) => expandProgramDay(template, link('smolov-jr', { day, roles }), 1));
    expect(days.map((items) => items.map((i) => i.kind === 'main' && i.sets))).toEqual([
      [[{ reps: 6, percent: 70, repeat: 6 }]],
      [[{ reps: 5, percent: 75, repeat: 7 }]],
      [[{ reps: 4, percent: 80, repeat: 8 }]],
      [[{ reps: 3, percent: 85, repeat: 10 }]],
    ]);
  });

  it('Smolov Jr. day 1, weeks 1-3 with a 2.5 kg increment: +0, +2.5, +5', () => {
    const template = get('smolov-jr');
    const l = link('smolov-jr', { roles: { lift: 'barbell-bench-press' }, params: { weeklyIncrementKg: 2.5 } });
    const sets = [1, 2, 3].map((week) => {
      const [item] = expandProgramDay(template, l, week);
      return item.kind === 'main' ? item.sets : null;
    });
    expect(sets).toEqual([
      [{ reps: 6, percent: 70, repeat: 6 }],
      [{ reps: 6, percent: 70, repeat: 6, addKg: 2.5 }],
      [{ reps: 6, percent: 70, repeat: 6, addKg: 5 }],
    ]);
  });

  it('Smolov Jr. week 3 with a 3.5 kg increment adds 7 kg', () => {
    const l = link('smolov-jr', { roles: { lift: 'barbell-back-squat' }, params: { weeklyIncrementKg: 3.5 } });
    expect(expandProgramDay(get('smolov-jr'), l, 3)[0]).toMatchObject({ sets: [{ addKg: 7 }] });
  });

  it('custom 5/3/1: 3x5 @75, 3x3 @85, 3x1 @95', () => {
    const l = link('cycle-531-custom', { roles: { lift: 'overhead-press' } });
    const sets = [1, 2, 3].map((week) => {
      const [item] = expandProgramDay(get('cycle-531-custom'), l, week);
      return item.kind === 'main' ? item.sets : null;
    });
    expect(sets).toEqual([
      [{ reps: 5, percent: 75, repeat: 3 }],
      [{ reps: 3, percent: 85, repeat: 3 }],
      [{ reps: 1, percent: 95, repeat: 3 }],
    ]);
  });

  it('custom 5/3/1 applies a parameter override (week 2 at 82.5 %)', () => {
    const l = link('cycle-531-custom', { roles: { lift: 'overhead-press' }, params: { week2Percent: 0.825 } });
    const [item] = expandProgramDay(get('cycle-531-custom'), l, 2);
    expect(item).toMatchObject({
      kind: 'main',
      exerciseId: 'overhead-press',
      basisExerciseId: 'overhead-press',
      sets: [{ reps: 3, percent: 82.5, repeat: 3 }],
      unverified: false,
    });
  });
});

describe('expandProgramDay on real data', () => {
  it('Sheiko #29 week 1 day 2 without accessories: two variations on the deadlift basis', () => {
    const items = expandProgramDay(get('sheiko-29'), link('sheiko-29', { day: 2, roles: { deadlift: 'trap-bar-deadlift' } }), 1);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      kind: 'main',
      exerciseId: 'deadlift-to-knees',
      basisExerciseId: 'trap-bar-deadlift',
      label: { en: 'Deadlift up to knees' },
      sets: [
        { reps: 3, percent: 50 },
        { reps: 3, percent: 60, repeat: 2 },
        { reps: 3, percent: 70, repeat: 2 },
        { reps: 3, percent: 75, repeat: 4 },
      ],
    });
    expect(items[1]).toMatchObject({
      kind: 'main',
      exerciseId: 'deadlift-from-boxes',
      basisExerciseId: 'trap-bar-deadlift',
      sets: [
        { reps: 4, percent: 55 },
        { reps: 4, percent: 65 },
        { reps: 4, percent: 75, repeat: 2 },
        { reps: 3, percent: 85, repeat: 4 },
      ],
    });
  });

  it('Sheiko #29 week 1 day 2 with accessories: the original order', () => {
    const items = expandProgramDay(
      get('sheiko-29'),
      link('sheiko-29', { day: 2, accessories: true, roles: { deadlift: 'conventional-deadlift' } }),
      1,
    );
    expect(items.map((i) => (i.kind === 'note' ? 'note' : i.exerciseId))).toEqual([
      'deadlift-to-knees',
      'incline-barbell-bench-press',
      'parallel-bar-dip',
      'deadlift-from-boxes',
      'dumbbell-walking-lunge',
      'crunch',
    ]);
    expect(items[1]).toEqual({
      kind: 'accessory',
      exerciseId: 'incline-barbell-bench-press',
      label: { en: 'Incline bench press', 'pt-BR': 'Supino inclinado' },
      sets: 4,
      reps: 6,
    });
  });

  it('skips the main items of roles that are not mapped', () => {
    const items = expandProgramDay(get('sheiko-29'), link('sheiko-29', { roles: { bench: 'barbell-bench-press' } }), 1);
    expect(items.map((i) => i.kind === 'main' && i.exerciseId)).toEqual(['barbell-bench-press', 'barbell-bench-press']);
  });

  it('Smolov rest days are rest days, training days are not', () => {
    const roles = { squat: 'barbell-back-squat' };
    expect(isRestDay(expandProgramDay(get('smolov'), link('smolov', { day: 4, roles }), 1))).toBe(true);
    expect(isRestDay(expandProgramDay(get('smolov'), link('smolov', { day: 1, roles }), 1))).toBe(false);
    // Week 6: only the last two days test the 1RM; the first two are rest.
    expect(isRestDay(expandProgramDay(get('smolov'), link('smolov', { day: 1, roles }), 6))).toBe(true);
    const test = expandProgramDay(get('smolov'), link('smolov', { day: 3, roles }), 6);
    expect(test).toEqual([
      expect.objectContaining({ kind: 'free', exerciseId: 'barbell-back-squat', unverified: false }),
    ]);
  });

  it('Smolov fixed increments become addKg and the disputed sets stay unverified', () => {
    const roles = { squat: 'barbell-back-squat' };
    const base = expandProgramDay(get('smolov'), link('smolov', { day: 1, roles }), 4)[0];
    expect(base).toMatchObject({ sets: [{ reps: 9, percent: 70, repeat: 4, addKg: 10 }] });
    const disputed = expandProgramDay(get('smolov'), link('smolov', { day: 1, roles }), 9)[0];
    expect(disputed).toMatchObject({ unverified: true });
    expect(disputed.kind === 'main' && disputed.sets.at(-1)).toEqual({ reps: 5, unverified: true });
    expect(disputed.kind === 'main' && disputed.setNotes).toHaveLength(1);
  });

  it('Smolov week 2 keeps 82.5 % exact', () => {
    const [item] = expandProgramDay(get('smolov'), link('smolov', { day: 2, roles: { squat: 'barbell-back-squat' } }), 2);
    expect(item).toMatchObject({ sets: [{ reps: 5, percent: 82.5 }] });
  });

  it('Sheiko #32 max attempts with a mapped role become a free exercise without a load', () => {
    const items = expandProgramDay(get('sheiko-32'), link('sheiko-32', { day: 2, roles: { squat: 'barbell-back-squat' } }), 1);
    const free = items.find((i) => i.kind === 'free');
    expect(free).toMatchObject({ kind: 'free', exerciseId: 'barbell-back-squat', unverified: true });
    expect(free?.kind === 'free' && free.note.en).toMatch(/^Max attempts/);
  });

  it('Sheiko #32 competition days without roles are notes only: rest', () => {
    const items = expandProgramDay(get('sheiko-32'), link('sheiko-32', { day: 3, roles: {} }), 4);
    expect(items.every((i) => i.kind === 'note')).toBe(true);
    expect(isRestDay(items)).toBe(true);
  });
});
