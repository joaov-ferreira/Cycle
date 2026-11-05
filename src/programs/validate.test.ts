import type { ProgramTemplate } from './schema';
import { validateTemplate, type TemplateIssueCode } from './validate';

/** A minimal valid 2-week, 2-day template; tests break one thing at a time. */
function valid(): ProgramTemplate {
  const day = (n: number) => ({
    day: n,
    items: [{ kind: 'main' as const, lift: 'squat' as const, sets: [{ reps: 5, percent: 0.7, repeat: 3 }] }],
  });
  return {
    id: 'test',
    family: 'smolov-jr',
    name: 'Test',
    version: 'v1',
    source: { author: 'A', reference: 'R', accessedAt: '2026-11-05' },
    verification: 'verified',
    durationWeeks: 2,
    daysPerWeek: 2,
    allowedLifts: ['squat'],
    liftSelectable: false,
    weeks: [
      { week: 1, days: [day(1), day(2)] },
      { week: 2, days: [day(1), day(2)] },
    ],
  };
}

function codes(template: ProgramTemplate): TemplateIssueCode[] {
  return validateTemplate(template).map((i) => i.code);
}

describe('validateTemplate', () => {
  it('accepts a consistent template', () => {
    expect(validateTemplate(valid())).toEqual([]);
  });

  it('requires id, name and version', () => {
    expect(codes({ ...valid(), id: ' ' })).toEqual(['missingId']);
    expect(codes({ ...valid(), name: '' })).toEqual(['missingName']);
    expect(codes({ ...valid(), version: '' })).toEqual(['missingVersion']);
  });

  it('requires a complete source with an ISO access date', () => {
    const t = valid();
    expect(validateTemplate({ ...t, source: { ...t.source, author: '' } })).toEqual([
      { code: 'missingSource', path: 'source.author' },
    ]);
    expect(validateTemplate({ ...t, source: { ...t.source, reference: ' ' } })).toEqual([
      { code: 'missingSource', path: 'source.reference' },
    ]);
    expect(validateTemplate({ ...t, source: { ...t.source, accessedAt: '5/11/2026' } })).toEqual([
      { code: 'invalidAccessDate', path: 'source.accessedAt' },
    ]);
    expect(codes({ ...t, source: { ...t.source, accessedAt: '2026-02-30' } })).toEqual(['invalidAccessDate']);
  });

  it('rejects a missing source object', () => {
    const t = { ...valid(), source: undefined } as unknown as ProgramTemplate;
    expect(codes(t)).toEqual(['missingSource']);
  });

  it('requires a known verification status', () => {
    expect(codes({ ...valid(), verification: 'maybe' as never })).toEqual(['invalidVerification']);
  });

  it('checks the duration against the weeks', () => {
    const t = valid();
    expect(codes({ ...t, durationWeeks: 3 })).toEqual(['weekCountMismatch']);
    expect(codes({ ...t, durationWeeks: 0, weeks: [] })).toEqual(['invalidDuration']);
  });

  it('numbers weeks and days consecutively from 1', () => {
    const t = valid();
    const weeks = [t.weeks[0], { ...t.weeks[1], week: 3 }];
    expect(validateTemplate({ ...t, weeks })).toEqual([{ code: 'weekNumberMismatch', path: 'weeks[1]' }]);
    const days = [t.weeks[0].days[0], { ...t.weeks[0].days[1], day: 1 }];
    expect(validateTemplate({ ...t, weeks: [{ week: 1, days }, t.weeks[1]] })).toEqual([
      { code: 'dayNumberMismatch', path: 'weeks[0].days[1]' },
    ]);
  });

  it('requires every week to have daysPerWeek days', () => {
    const t = valid();
    const weeks = [{ week: 1, days: [t.weeks[0].days[0]] }, t.weeks[1]];
    expect(validateTemplate({ ...t, weeks })).toEqual([{ code: 'dayCountMismatch', path: 'weeks[0]' }]);
    expect(codes({ ...t, daysPerWeek: 0 })).toContain('invalidDaysPerWeek');
  });

  it('requires at least one item per day', () => {
    const t = valid();
    const weeks = [{ week: 1, days: [{ day: 1, items: [] }, t.weeks[0].days[1]] }, t.weeks[1]];
    expect(validateTemplate({ ...t, weeks })).toEqual([{ code: 'emptyDay', path: 'weeks[0].days[0]' }]);
  });

  it('requires allowed lifts, and a choice of lift only when several are allowed', () => {
    expect(codes({ ...valid(), allowedLifts: [] })).toContain('noAllowedLifts');
    expect(codes({ ...valid(), liftSelectable: true })).toEqual(['liftSelectableMismatch']);
    expect(codes({ ...valid(), allowedLifts: ['squat', 'bench'] })).toEqual(['liftSelectableMismatch']);
  });

  it('checks the lift of main items against the template', () => {
    const t = valid();
    const item = (lift: 'bench' | 'selected') => ({
      kind: 'main' as const,
      lift,
      sets: [{ reps: 5, percent: 0.7 }],
    });
    const withItem = (i: ReturnType<typeof item>): ProgramTemplate => ({
      ...t,
      weeks: [{ week: 1, days: [{ day: 1, items: [i] }, t.weeks[0].days[1]] }, t.weeks[1]],
    });
    expect(validateTemplate(withItem(item('bench')))).toEqual([
      { code: 'liftNotAllowed', path: 'weeks[0].days[0].items[0]' },
    ]);
    expect(validateTemplate(withItem(item('selected')))).toEqual([
      { code: 'liftNotAllowed', path: 'weeks[0].days[0].items[0]' },
    ]);
  });

  it('accepts "selected" lifts when the template lets the user pick', () => {
    const t: ProgramTemplate = {
      ...valid(),
      allowedLifts: ['bench', 'squat'],
      liftSelectable: true,
      weeks: [
        {
          week: 1,
          days: [
            { day: 1, items: [{ kind: 'main', lift: 'selected', sets: [{ reps: 5, percent: 0.7 }] }] },
            { day: 2, items: [{ kind: 'main', lift: 'selected', sets: [{ reps: 5, percent: 0.7 }] }] },
          ],
        },
        valid().weeks[1],
      ],
    };
    expect(validateTemplate(t)).toEqual([]);
  });

  it('validates sets: reps, repeat and percent', () => {
    const t = valid();
    const bad = (set: object): ProgramTemplate => ({
      ...t,
      weeks: [
        {
          week: 1,
          days: [
            { day: 1, items: [{ kind: 'main', lift: 'squat', sets: [set as never] }] },
            t.weeks[0].days[1],
          ],
        },
        t.weeks[1],
      ],
    });
    const path = 'weeks[0].days[0].items[0].sets[0]';
    expect(validateTemplate(bad({ reps: 0, percent: 0.7 }))).toEqual([{ code: 'invalidReps', path }]);
    expect(validateTemplate(bad({ reps: 2.5, percent: 0.7 }))).toEqual([{ code: 'invalidReps', path }]);
    expect(validateTemplate(bad({ reps: 5, percent: 0.7, repeat: 0 }))).toEqual([
      { code: 'invalidRepeat', path },
    ]);
    expect(validateTemplate(bad({ reps: 5, percent: 0 }))).toEqual([{ code: 'invalidPercent', path }]);
    expect(validateTemplate(bad({ reps: 5, percent: 1.6 }))).toEqual([{ code: 'invalidPercent', path }]);
    expect(validateTemplate(bad({ reps: 5 }))).toEqual([{ code: 'missingPercent', path }]);
  });

  it('allows a set without percent only when flagged unverified with a note', () => {
    const t = valid();
    const withSet = (set: object): ProgramTemplate => ({
      ...t,
      verification: 'partial',
      weeks: [
        {
          week: 1,
          days: [
            { day: 1, items: [{ kind: 'main', lift: 'squat', sets: [set as never] }] },
            t.weeks[0].days[1],
          ],
        },
        t.weeks[1],
      ],
    });
    const path = 'weeks[0].days[0].items[0].sets[0]';
    expect(validateTemplate(withSet({ reps: 5, unverified: true, note: { en: 'Percentage missing' } }))).toEqual(
      [],
    );
    expect(validateTemplate(withSet({ reps: 5, unverified: true }))).toEqual([
      { code: 'unverifiedWithoutNote', path },
    ]);
  });

  it('does not let a verified template contain unverified sets', () => {
    const t = valid();
    const set = { reps: 5, percent: 0.7, unverified: true, note: { en: 'x' } };
    const bad: ProgramTemplate = {
      ...t,
      weeks: [
        {
          week: 1,
          days: [
            { day: 1, items: [{ kind: 'main', lift: 'squat', sets: [set] }] },
            t.weeks[0].days[1],
          ],
        },
        t.weeks[1],
      ],
    };
    expect(codes(bad)).toEqual(['verifiedWithUnverifiedData']);
  });

  it('requires main items to have sets and accessory items to have text', () => {
    const t = valid();
    const withItems = (items: never[]): ProgramTemplate => ({
      ...t,
      weeks: [{ week: 1, days: [{ day: 1, items }, t.weeks[0].days[1]] }, t.weeks[1]],
    });
    expect(codes(withItems([{ kind: 'main', lift: 'squat', sets: [] }] as never))).toEqual(['emptySets']);
    expect(
      codes(withItems([{ kind: 'accessory', name: { en: 'Rows' }, text: { en: ' ' } }] as never)),
    ).toEqual(['missingText']);
    expect(
      codes(withItems([{ kind: 'accessory', name: { en: '' }, text: { en: '3x10' } }] as never)),
    ).toEqual(['missingText']);
    expect(codes(withItems([{ kind: 'other' }] as never))).toEqual(['invalidItemKind']);
    expect(
      validateTemplate(withItems([{ kind: 'accessory', name: { en: 'Rows' }, text: { en: '3x10' } }] as never)),
    ).toEqual([]);
  });

  describe('configurable parameters', () => {
    const param = { id: 'p', label: { en: 'P' }, unit: 'fraction' as const, min: 0.3, max: 1.05, step: 0.005, default: 0.7, source: 's' };
    const withParam = (p: object, set: object = { reps: 5, percent: 0.7, percentParam: 'p' }): ProgramTemplate => {
      const t = valid();
      return {
        ...t,
        configurable: [p as never],
        weeks: [
          {
            week: 1,
            days: [{ day: 1, items: [{ kind: 'main', lift: 'squat', sets: [set as never] }] }, t.weeks[0].days[1]],
          },
          t.weeks[1],
        ],
      };
    };

    it('accepts a well-formed parameter referenced by a set', () => {
      expect(validateTemplate(withParam(param))).toEqual([]);
    });

    it('rejects duplicate ids, inverted ranges and defaults outside the range or step', () => {
      const t = withParam(param);
      expect(codes({ ...t, configurable: [param, param] })).toEqual(['duplicateParam']);
      expect(validateTemplate(withParam({ ...param, min: 2, max: 1 }))).toContainEqual({
        code: 'invalidParam',
        path: 'configurable[0]',
      });
      expect(validateTemplate(withParam({ ...param, default: 0.2 }, { reps: 5, percent: 0.2, percentParam: 'p' }))).toEqual([
        { code: 'invalidParam', path: 'configurable[0]' },
      ]);
      expect(validateTemplate(withParam({ ...param, default: 0.7012 }, { reps: 5, percent: 0.7012, percentParam: 'p' }))).toEqual([
        { code: 'invalidParam', path: 'configurable[0]' },
      ]);
      expect(codes(withParam({ ...param, source: '' }))).toEqual(['invalidParam']);
      expect(codes(withParam({ ...param, step: 0 }))).toEqual(['invalidParam']);
      expect(codes(withParam({ ...param, unit: 'lb' }, { reps: 5, percent: 0.7 }))).toEqual(['invalidParam']);
    });

    it('requires references to point to an existing parameter of a matching unit', () => {
      const path = 'weeks[0].days[0].items[0].sets[0]';
      expect(validateTemplate(withParam(param, { reps: 5, percent: 0.7, percentParam: 'zzz' }))).toEqual([
        { code: 'unknownParam', path },
      ]);
      expect(validateTemplate(withParam(param, { reps: 5, percent: 0.7, addKg: { param: 'zzz' } }))).toEqual([
        { code: 'unknownParam', path },
      ]);
      expect(
        validateTemplate(withParam({ ...param, unit: 'kg', min: 1, max: 5, step: undefined, default: 2 }, { reps: 5, percent: 0.7, percentParam: 'p' })),
      ).toEqual([{ code: 'paramUnitMismatch', path }]);
      expect(validateTemplate(withParam(param, { reps: 5, percent: 0.7, addKg: { param: 'p' } }))).toEqual([
        { code: 'paramUnitMismatch', path },
      ]);
    });

    it('accepts a positive integer multiple of a kg parameter and rejects any other multiplier', () => {
      const kg = { ...param, unit: 'kg' as const, min: 2.5, max: 5, step: 0.25, default: 2.5 };
      const path = 'weeks[0].days[0].items[0].sets[0]';
      expect(validateTemplate(withParam(kg, { reps: 5, percent: 0.7, addKg: { param: 'p', times: 2 } }))).toEqual([]);
      for (const times of [0, -1, 1.5, Number.NaN]) {
        expect(validateTemplate(withParam(kg, { reps: 5, percent: 0.7, addKg: { param: 'p', times } }))).toEqual([
          { code: 'invalidParamMultiplier', path },
        ]);
      }
    });

    it('requires a percent-linked set to carry the parameter default as its percent', () => {
      expect(validateTemplate(withParam(param, { reps: 5, percent: 0.75, percentParam: 'p' }))).toEqual([
        { code: 'percentDefaultMismatch', path: 'weeks[0].days[0].items[0].sets[0]' },
      ]);
    });
  });
});
