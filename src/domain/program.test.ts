import {
  expandProgramDay,
  isRestDay,
  programDay,
  programWeekFor,
  resolveParams,
  validateParams,
  validateProgram,
  type ProgramLink,
  type ProgramTemplate,
} from './program';

const exists = (id: string) => ['bench-x', 'squat-x', 'dead-x', 'var-x', 'acc-x', 'other-x'].includes(id);

/** A small valid template with every kind of item and both parameter styles. */
function base(): ProgramTemplate {
  return {
    id: 't1',
    family: 'sheiko',
    name: 'Test',
    version: 'v1',
    source: { author: 'A', reference: 'R', accessedAt: '2026-11-05' },
    verification: 'partial',
    durationWeeks: 2,
    daysPerWeek: 2,
    roles: [
      { id: 'bench', label: { en: 'Bench' }, defaultExerciseId: 'bench-x' },
      { id: 'squat', label: { en: 'Squat' }, fixedInOriginal: true },
    ],
    configurable: [
      { id: 'p1', label: { en: 'P1' }, unit: 'fraction', min: 0.3, max: 1, step: 0.005, default: 0.825, source: 's' },
      { id: 'inc', label: { en: 'Inc' }, unit: 'kg', min: 2.5, max: 5, step: 0.5, default: 2.5, source: 's' },
    ],
    weeks: [
      {
        week: 1,
        days: [
          {
            day: 1,
            items: [
              { kind: 'main', role: 'bench', sets: [{ reps: 5, percent: 0.75 }, { reps: 3, percent: 0.825, repeat: 2, amrap: true }] },
              { kind: 'accessory', exerciseId: 'acc-x', name: { en: 'Fly' }, sets: 5, reps: 10 },
              {
                kind: 'main',
                role: 'squat',
                variation: { exerciseId: 'var-x', name: { en: 'Var' } },
                sets: [{ reps: 4, percent: 0.825, percentParam: 'p1', addKg: { param: 'inc', times: 2 } }],
                note: { en: 'n' },
              },
              { kind: 'info', text: { en: 'Note' } },
            ],
          },
          { day: 2, items: [{ kind: 'info', text: { en: 'Rest' } }] },
        ],
      },
      {
        week: 2,
        days: [
          {
            day: 1,
            items: [
              { kind: 'main', role: 'bench', sets: [{ reps: 1, unverified: true, note: { en: 'why' } }, { reps: 2, percent: 0.5, addKg: { kg: 10 } }] },
              { kind: 'info', role: 'squat', text: { en: 'Test' }, unverified: true, note: { en: 'why' } },
            ],
          },
          { day: 2, items: [{ kind: 'info', text: { en: 'Rest' } }] },
        ],
      },
    ],
  };
}

const codes = (t: ProgramTemplate) => validateProgram(t, exists).map((i) => i.code);

describe('validateProgram', () => {
  it('accepts a valid template', () => {
    expect(validateProgram(base(), exists)).toEqual([]);
  });

  it('flags required fields', () => {
    const t = { ...base(), id: ' ', name: '', version: '' };
    expect(codes(t)).toEqual(expect.arrayContaining(['missingId', 'missingName', 'missingVersion']));
    expect(codes({ ...base(), variant: ' ' })).toContain('missingVariant');
  });

  it('requires a source with author, reference and a real date', () => {
    expect(codes({ ...base(), source: undefined as never })).toContain('missingSource');
    expect(codes({ ...base(), source: { author: '', reference: '', accessedAt: '2026-11-05' } })).toEqual(
      expect.arrayContaining(['missingSource']),
    );
    expect(validateProgram({ ...base(), source: { author: 'a', reference: 'r', accessedAt: '2026-02-30' } }, exists)).toEqual([
      { code: 'invalidAccessDate', path: 'source.accessedAt' },
    ]);
    expect(codes({ ...base(), source: { author: 'a', reference: 'r', accessedAt: 'x' } })).toContain('invalidAccessDate');
  });

  it('checks verification, duration and days per week', () => {
    expect(codes({ ...base(), verification: 'nope' as never })).toContain('invalidVerification');
    expect(codes({ ...base(), durationWeeks: 0 })).toContain('invalidDuration');
    expect(codes({ ...base(), daysPerWeek: 0 })).toContain('invalidDaysPerWeek');
  });

  it('requires as many weeks as durationWeeks, numbered in order', () => {
    expect(codes({ ...base(), durationWeeks: 3 })).toContain('weekCountMismatch');
    const t = base();
    t.weeks[1] = { ...t.weeks[1], week: 5 };
    expect(codes(t)).toContain('weekNumberMismatch');
  });

  it('allows fewer days than daysPerWeek but not more, and numbers them', () => {
    const t = base();
    t.weeks[0].days = t.weeks[0].days.slice(0, 1);
    expect(codes(t)).toEqual([]);
    const many = base();
    many.daysPerWeek = 1;
    expect(codes(many)).toContain('tooManyDays');
    const num = base();
    num.weeks[0].days[1] = { ...num.weeks[0].days[1], day: 4 };
    expect(codes(num)).toContain('dayNumberMismatch');
    const empty = base();
    empty.weeks[0].days[1] = { day: 2, items: [] };
    expect(codes(empty)).toContain('emptyDay');
  });

  it('requires declared, unique roles', () => {
    expect(codes({ ...base(), roles: [] })).toContain('noRoles');
    const dup = base();
    dup.roles = [dup.roles[0], dup.roles[0], dup.roles[1]];
    expect(codes(dup)).toContain('duplicateRole');
    const blank = base();
    blank.roles = [{ id: '', label: { en: '' } }, ...blank.roles];
    expect(codes(blank)).toContain('invalidRole');
  });

  it('flags a role default or item role that is not valid', () => {
    const t = base();
    t.roles[0] = { ...t.roles[0], defaultExerciseId: 'ghost' };
    expect(validateProgram(t, exists)).toEqual([{ code: 'unknownExercise', path: 'roles[0].defaultExerciseId' }]);
    const m = base();
    m.weeks[0].days[0].items[0] = { kind: 'main', role: 'ghost', sets: [{ reps: 1, percent: 0.5 }] };
    expect(validateProgram(m, exists)).toEqual([{ code: 'unknownRole', path: 'weeks[0].days[0].items[0]' }]);
    const i = base();
    i.weeks[1].days[0].items[1] = { kind: 'info', role: 'ghost', text: { en: 'x' } };
    expect(codes(i)).toContain('unknownRole');
  });

  it('checks that variation and accessory exercises exist', () => {
    const v = base();
    v.weeks[0].days[0].items[2] = {
      kind: 'main',
      role: 'squat',
      variation: { exerciseId: 'ghost', name: { en: 'V' } },
      sets: [{ reps: 1, percent: 0.5 }],
    };
    expect(codes(v)).toEqual(['unknownExercise']);
    const blankName = base();
    blankName.weeks[0].days[0].items[2] = {
      kind: 'main',
      role: 'squat',
      variation: { exerciseId: 'var-x', name: { en: ' ' } },
      sets: [{ reps: 1, percent: 0.5 }],
    };
    expect(codes(blankName)).toEqual(['missingText']);
    const a = base();
    a.weeks[0].days[0].items[1] = { kind: 'accessory', exerciseId: 'ghost', name: { en: 'F' }, sets: 5, reps: 10 };
    expect(codes(a)).toEqual(['unknownExercise']);
  });

  it('checks accessory text and set counts', () => {
    const a = base();
    a.weeks[0].days[0].items[1] = { kind: 'accessory', exerciseId: 'acc-x', name: { en: '' }, sets: 0, reps: 101 };
    expect(codes(a)).toEqual(expect.arrayContaining(['missingText', 'invalidSets', 'invalidReps']));
  });

  it('checks info text', () => {
    const t = base();
    t.weeks[0].days[0].items[3] = { kind: 'info', text: { en: ' ' } };
    expect(codes(t)).toContain('missingText');
  });

  it('rejects an unknown item kind', () => {
    const t = base();
    t.weeks[0].days[0].items[3] = { kind: 'weird' } as never;
    expect(codes(t)).toContain('invalidItemKind');
  });

  it('checks set values', () => {
    const set = (s: object) => {
      const t = base();
      t.weeks[0].days[0].items[0] = { kind: 'main', role: 'bench', sets: [s as never] };
      return codes(t);
    };
    expect(set({ reps: 0, percent: 0.5 })).toContain('invalidReps');
    expect(set({ reps: 101, percent: 0.5 })).toContain('invalidReps');
    expect(set({ reps: 1.5, percent: 0.5 })).toContain('invalidReps');
    expect(set({ reps: 1, percent: 0.5, repeat: 0 })).toContain('invalidRepeat');
    expect(set({ reps: 1, percent: 0.5, repeat: 21 })).toContain('invalidRepeat');
    expect(set({ reps: 1, percent: 0 })).toContain('invalidPercent');
    expect(set({ reps: 1, percent: 1.25 })).toContain('invalidPercent');
    expect(set({ reps: 1, percent: 0.7525 })).toContain('invalidPercent');
    expect(set({ reps: 1, percent: 1.2 })).toEqual([]);
    expect(set({ reps: 1 })).toContain('missingPercent');
    expect(set({ reps: 1, percent: 0.5, addKg: { kg: 0 } })).toContain('invalidAddKg');
    expect(set({ reps: 1, percent: 0.5, addKg: { kg: 101 } })).toContain('invalidAddKg');
    expect(set({ reps: 1, percent: 0.5, addKg: { kg: 2.555 } })).toContain('invalidAddKg');
    expect(set({ reps: 1, percent: 0.5, addKg: { param: 'inc', times: 0 } })).toContain('invalidMultiplier');
  });

  it('checks parameter references and defaults', () => {
    const set = (s: object) => {
      const t = base();
      t.weeks[0].days[0].items[0] = { kind: 'main', role: 'bench', sets: [s as never] };
      return codes(t);
    };
    expect(set({ reps: 1, percent: 0.825, percentParam: 'zz' })).toContain('unknownParam');
    expect(set({ reps: 1, percent: 0.825, percentParam: 'inc' })).toContain('paramUnitMismatch');
    expect(set({ reps: 1, percent: 0.8, percentParam: 'p1' })).toContain('percentDefaultMismatch');
    expect(set({ reps: 1, percent: 0.5, addKg: { param: 'zz' } })).toContain('unknownParam');
    expect(set({ reps: 1, percent: 0.5, addKg: { param: 'p1' } })).toContain('paramUnitMismatch');
  });

  it('checks the parameters themselves', () => {
    const t = base();
    t.configurable = [t.configurable![0], t.configurable![0]];
    expect(codes(t)).toContain('duplicateParam');
    const bad = base();
    bad.configurable = [{ ...bad.configurable![1], default: 9 }];
    expect(codes(bad)).toContain('invalidParam');
    const off = base();
    off.configurable = [{ ...off.configurable![1], default: 2.75 }];
    expect(codes(off)).toContain('invalidParam');
    const noLabel = base();
    noLabel.configurable = [{ ...noLabel.configurable![1], label: { en: '' } }];
    expect(codes(noLabel)).toContain('invalidParam');
    const range = base();
    range.configurable = [{ ...range.configurable![1], min: 6 }];
    expect(codes(range)).toContain('invalidParam');
    const step = base();
    step.configurable = [{ ...step.configurable![1], step: 0 }];
    expect(codes(step)).toContain('invalidParam');
    const noStep = base();
    noStep.configurable = [noStep.configurable![0], { ...noStep.configurable![1], step: undefined, default: 3.1 }];
    expect(codes(noStep)).toEqual([]);
  });

  it('requires a note for unverified data and forbids it in verified templates', () => {
    const t = base();
    t.weeks[1].days[0].items[0] = { kind: 'main', role: 'bench', sets: [{ reps: 1, unverified: true }] };
    expect(codes(t)).toContain('unverifiedWithoutNote');
    const v = { ...base(), verification: 'verified' as const };
    expect(codes(v)).toEqual(expect.arrayContaining(['verifiedWithUnverifiedData']));
    const i = base();
    i.weeks[1].days[0].items[1] = { kind: 'info', role: 'squat', text: { en: 'x' }, unverified: true };
    expect(codes(i)).toContain('unverifiedWithoutNote');
  });
});

describe('resolveParams and validateParams', () => {
  it('returns the defaults and valid overrides', () => {
    expect(resolveParams(base())).toEqual({ p1: 0.825, inc: 2.5 });
    expect(resolveParams(base(), { inc: 4 })).toEqual({ p1: 0.825, inc: 4 });
  });

  it('ignores unknown or invalid overrides', () => {
    expect(resolveParams(base(), { inc: 9, zz: 1, p1: 0.9 })).toEqual({ p1: 0.9, inc: 2.5 });
    expect(resolveParams({ ...base(), configurable: undefined }, { a: 1 })).toEqual({});
  });

  it('reports unknown, out-of-range and off-step values', () => {
    expect(validateParams(base(), { zz: 1, inc: 6, p1: 0.8251, ok: 2 } as never)).toEqual([
      { param: 'zz', code: 'unknownParam' },
      { param: 'inc', code: 'paramOutOfRange' },
      { param: 'p1', code: 'paramOffStep' },
      { param: 'ok', code: 'unknownParam' },
    ]);
    expect(validateParams(base(), { inc: Number.NaN })).toEqual([{ param: 'inc', code: 'paramOutOfRange' }]);
    expect(validateParams(base(), { inc: 4, p1: 0.9 })).toEqual([]);
    expect(validateParams(base(), undefined)).toEqual([]);
  });
});

describe('programWeekFor', () => {
  it.each([
    [1, 1, 3, 1],
    [1, 4, 3, 1],
    [4, 2, 13, 5],
    [12, 3, 13, 1],
  ])('(%i, %i, %i) -> %i', (start, cycle, duration, expected) => {
    expect(programWeekFor(start, cycle, duration)).toBe(expected);
  });
});

describe('programDay', () => {
  it('finds a day or returns null', () => {
    expect(programDay(base(), 1, 2)?.day).toBe(2);
    expect(programDay(base(), 3, 1)).toBeNull();
    expect(programDay(base(), 1, 9)).toBeNull();
  });
});

const link = (over: Partial<ProgramLink> = {}): ProgramLink => ({
  id: 'l1',
  programId: 't1',
  day: 1,
  startWeek: 1,
  roles: { bench: 'bench-x', squat: 'squat-x' },
  accessories: true,
  ...over,
});

describe('expandProgramDay', () => {
  it('expands every item kind in order with percent units and resolved parameters', () => {
    expect(expandProgramDay(base(), link(), 1)).toEqual([
      {
        kind: 'main',
        exerciseId: 'bench-x',
        basisExerciseId: 'bench-x',
        sets: [{ reps: 5, percent: 75 }, { reps: 3, percent: 82.5, repeat: 2, amrap: true }],
        unverified: false,
      },
      { kind: 'accessory', exerciseId: 'acc-x', label: { en: 'Fly' }, sets: 5, reps: 10 },
      {
        kind: 'main',
        exerciseId: 'var-x',
        basisExerciseId: 'squat-x',
        label: { en: 'Var' },
        sets: [{ reps: 4, percent: 82.5, addKg: 5 }],
        note: { en: 'n' },
        unverified: false,
      },
      { kind: 'note', text: { en: 'Note' } },
    ]);
  });

  it('applies parameter overrides', () => {
    const items = expandProgramDay(base(), link({ params: { p1: 0.9, inc: 3.5 } }), 1);
    expect(items[2]).toMatchObject({ sets: [{ reps: 4, percent: 90, addKg: 7 }] });
  });

  it('multiplies on integers so 2 x 2.5 is exactly 5', () => {
    const items = expandProgramDay(base(), link({ params: { inc: 2.5 } }), 1);
    expect(items[2]).toMatchObject({ sets: [{ addKg: 5 }] });
  });

  it('skips items of unmapped roles', () => {
    const items = expandProgramDay(base(), link({ roles: { bench: 'bench-x' } }), 1);
    expect(items.map((i) => i.kind)).toEqual(['main', 'accessory', 'note']);
  });

  it('omits accessories when the link has them off', () => {
    const items = expandProgramDay(base(), link({ accessories: false }), 1);
    expect(items.map((i) => i.kind)).toEqual(['main', 'main', 'note']);
  });

  it('keeps unverified sets without percent, fixed kg and set notes', () => {
    expect(expandProgramDay(base(), link(), 2)).toEqual([
      {
        kind: 'main',
        exerciseId: 'bench-x',
        basisExerciseId: 'bench-x',
        sets: [{ reps: 1, unverified: true }, { reps: 2, percent: 50, addKg: 10 }],
        setNotes: [{ en: 'why' }],
        unverified: true,
      },
      { kind: 'free', exerciseId: 'squat-x', note: { en: 'Test' }, unverified: true },
    ]);
  });

  it('turns an info item with an unmapped role into nothing', () => {
    expect(expandProgramDay(base(), link({ roles: { bench: 'bench-x' } }), 2).map((i) => i.kind)).toEqual(['main']);
  });

  it('returns an empty list for a missing day and treats it as rest', () => {
    expect(expandProgramDay(base(), link({ day: 9 }), 1)).toEqual([]);
    expect(expandProgramDay(base(), link(), 7)).toEqual([]);
  });

  it('flags rest days: only notes', () => {
    expect(isRestDay(expandProgramDay(base(), link({ day: 2 }), 1))).toBe(true);
    expect(isRestDay(expandProgramDay(base(), link(), 1))).toBe(false);
    expect(isRestDay([])).toBe(true);
    expect(isRestDay(expandProgramDay(base(), link({ accessories: false, roles: {} }), 1))).toBe(true);
  });

  it('keeps percentages exact: 0.825 -> 82.5, 0.7 -> 70, 1.2 -> 120', () => {
    const t = base();
    t.weeks[0].days[0].items = [
      { kind: 'main', role: 'bench', sets: [{ reps: 1, percent: 0.7 }, { reps: 1, percent: 0.575 }, { reps: 1, percent: 1.2 }, { reps: 1, percent: 0.145 }] },
    ];
    expect(expandProgramDay(t, link(), 1)).toMatchObject([
      { sets: [{ percent: 70 }, { percent: 57.5 }, { percent: 120 }, { percent: 14.5 }] },
    ]);
  });
});
