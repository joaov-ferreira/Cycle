import type { ProgramTemplate } from '@/programs/schema';

import { changeSlotLift, changeSlotTemplate, defaultSlotInput, moveItem } from './session-slots';

const template = (id: string, overrides: Partial<ProgramTemplate>): ProgramTemplate => ({
  id,
  family: 'sheiko',
  name: id,
  version: 'v1',
  source: { author: 'A', reference: 'R', accessedAt: '2026-11-05' },
  verification: 'verified',
  durationWeeks: 3,
  daysPerWeek: 1,
  allowedLifts: ['bench', 'squat', 'deadlift'],
  liftSelectable: true,
  weeks: [],
  ...overrides,
});

const allLifts = template('all-lifts', {});
const long = template('long', { durationWeeks: 6, daysPerWeek: 4, allowedLifts: ['squat'], liftSelectable: false });
const TEMPLATES = [long, allLifts];

describe('defaultSlotInput', () => {
  it('uses the first template that allows the lift, day 1 and start week 1', () => {
    expect(defaultSlotInput('squat', TEMPLATES)).toEqual({ lift: 'squat', templateId: 'long', programDay: 1, startWeek: 1 });
    expect(defaultSlotInput('bench', TEMPLATES)).toEqual({ lift: 'bench', templateId: 'all-lifts', programDay: 1, startWeek: 1 });
  });

  it('returns null when no template allows the lift', () => {
    expect(defaultSlotInput('deadlift', [long])).toBeNull();
  });
});

describe('changeSlotLift', () => {
  it('keeps the program when it allows the new lift', () => {
    const slot = { lift: 'bench' as const, templateId: 'all-lifts', programDay: 1, startWeek: 1 };
    expect(changeSlotLift(slot, 'deadlift', TEMPLATES)).toEqual({ ...slot, lift: 'deadlift' });
  });

  it('switches to the first allowed program and resets day and week otherwise', () => {
    const slot = { lift: 'squat' as const, templateId: 'long', programDay: 3, startWeek: 4 };
    expect(changeSlotLift(slot, 'bench', TEMPLATES)).toEqual({
      lift: 'bench',
      templateId: 'all-lifts',
      programDay: 1,
      startWeek: 1,
    });
  });

  it('leaves the slot on its program when no template allows the lift', () => {
    const slot = { lift: 'squat' as const, templateId: 'long', programDay: 2, startWeek: 1 };
    expect(changeSlotLift(slot, 'bench', [long])).toEqual({ ...slot, lift: 'bench' });
  });
});

describe('changeSlotTemplate', () => {
  it('keeps day and start week when the new program has them', () => {
    const slot = { lift: 'squat' as const, templateId: 'all-lifts', programDay: 1, startWeek: 1 };
    expect(changeSlotTemplate(slot, 'long', TEMPLATES)).toEqual({ ...slot, templateId: 'long' });
  });

  it('clamps day and start week to the new program (max start = 3 − 2 = 1)', () => {
    const slot = { lift: 'squat' as const, templateId: 'long', programDay: 4, startWeek: 4 };
    expect(changeSlotTemplate(slot, 'all-lifts', TEMPLATES)).toEqual({
      lift: 'squat',
      templateId: 'all-lifts',
      programDay: 1,
      startWeek: 1,
    });
  });

  it('ignores an unknown program', () => {
    const slot = { lift: 'squat' as const, templateId: 'long', programDay: 2, startWeek: 2 };
    expect(changeSlotTemplate(slot, 'nope', TEMPLATES)).toBe(slot);
  });
});

describe('moveItem', () => {
  it('moves an element up or down by one', () => {
    expect(moveItem([1, 2, 3], 1, -1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 1, 1)).toEqual([1, 3, 2]);
  });

  it('returns an unchanged copy at the edges', () => {
    const list = [1, 2, 3];
    expect(moveItem(list, 0, -1)).toEqual([1, 2, 3]);
    expect(moveItem(list, 2, 1)).toEqual([1, 2, 3]);
    expect(moveItem(list, 5, 1)).toEqual([1, 2, 3]);
    expect(moveItem(list, 0, -1)).not.toBe(list);
  });
});
