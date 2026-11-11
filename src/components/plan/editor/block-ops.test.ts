import type { ProgramTemplate } from '@/domain/program';
import { findProgram } from '@/library';

import {
  defaultBlock,
  displayToParam,
  hasAccessories,
  newBlockId,
  paramToDisplay,
  withParam,
  withRole,
} from './block-ops';

const smolovJr = findProgram('smolov-jr') as ProgramTemplate;
const sheiko = findProgram('sheiko-29') as ProgramTemplate;
const smolov = findProgram('smolov') as ProgramTemplate;

describe('defaultBlock', () => {
  it('starts at day 1, week 1 with the default exercises of the roles that have one', () => {
    const block = defaultBlock('b1', sheiko, () => true);
    expect(block).toMatchObject({ id: 'b1', programId: 'sheiko-29', day: 1, startWeek: 1, accessories: false });
    expect(Object.keys(block.roles).sort()).toEqual(['bench', 'deadlift', 'squat']);
    expect(block.roles.bench).toBe('barbell-bench-press');
  });

  it('leaves roles without a default unmapped and skips defaults that do not exist', () => {
    expect(defaultBlock('b1', smolovJr, () => true).roles).toEqual({});
    expect(defaultBlock('b1', sheiko, (id) => id !== 'barbell-bench-press').roles.bench).toBeUndefined();
  });
});

describe('roles and params', () => {
  const block = defaultBlock('b1', smolov, () => true);

  it('maps and clears a role without mutating the block', () => {
    const mapped = withRole(block, 'squat', 'front-squat');
    expect(mapped.roles.squat).toBe('front-squat');
    expect(block.roles.squat).toBe('barbell-back-squat');
    expect(withRole(mapped, 'squat', undefined).roles).toEqual({});
  });

  it('stores a parameter, or drops it so the default applies', () => {
    const set = withParam(block, 'x', 2.5);
    expect(set.params).toEqual({ x: 2.5 });
    expect(withParam(set, 'x', undefined)).not.toHaveProperty('params');
    expect(withParam(withParam(set, 'y', 1), 'x', undefined).params).toEqual({ y: 1 });
  });
});

describe('parameter display', () => {
  it('shows fractions as percentages without floating-point noise', () => {
    expect(paramToDisplay({ unit: 'fraction' }, 0.7)).toBe(70);
    expect(paramToDisplay({ unit: 'fraction' }, 0.775)).toBe(77.5);
    expect(paramToDisplay({ unit: 'kg' }, 2.5)).toBe(2.5);
    expect(displayToParam({ unit: 'fraction' }, 77.5)).toBe(0.775);
    expect(displayToParam({ unit: 'fraction' }, 70)).toBe(0.7);
    expect(displayToParam({ unit: 'kg' }, 5)).toBe(5);
  });
});

describe('hasAccessories', () => {
  it('is true only for programs with accessory items', () => {
    expect(hasAccessories(sheiko)).toBe(true);
    expect(hasAccessories(smolovJr)).toBe(false);
  });
});

describe('newBlockId', () => {
  it('is unique among blocks and plan exercises', () => {
    const content = {
      name: 'x',
      description: '',
      sessionsPerWeek: 1,
      cycle: { loadWeeks: 3, deloadWeeks: 0, deloadVolumeFactor: 0.6, deloadLoadFactor: 0.9 },
      workouts: [
        {
          id: 'w1',
          name: 'A',
          programs: [{ id: 'p1', programId: 'smolov-jr', day: 1, startWeek: 1, roles: { lift: 'x' }, accessories: false }],
          exercises: [{ id: 'p2', exerciseId: 'x', sets: 1, repMin: 1, repMax: 1 }],
        },
      ],
    };
    expect(newBlockId(content)).toBe('p3');
  });
});
