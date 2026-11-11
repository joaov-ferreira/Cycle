import { DEFAULT_CYCLE, type CycleState } from '@/domain/cycle';
import { catalogs, translate, type TFunction } from '@/i18n';

import { adviceText, cycleStatusText } from './cycle-text';

const tFor =
  (locale: 'en' | 'pt-BR'): TFunction =>
  (key, params) =>
    translate(catalogs[locale], locale, key, params);

const state = (overrides: Partial<CycleState>): CycleState => ({
  cycleNumber: 1,
  phase: 'load',
  week: 1,
  sessionsDoneThisWeek: 0,
  nextWorkoutIndex: 0,
  ...overrides,
});

describe('cycleStatusText', () => {
  const cycle = { ...DEFAULT_CYCLE, loadWeeks: 6, deloadWeeks: 1 };

  it('names the cycle, phase and week out of the phase length', () => {
    expect(cycleStatusText(tFor('en'), cycle, state({ cycleNumber: 2, week: 3 }))).toBe('Cycle 2 · Load week 3 of 6');
    expect(cycleStatusText(tFor('en'), cycle, state({ phase: 'deload' }))).toBe('Cycle 1 · Deload week 1 of 1');
    expect(cycleStatusText(tFor('pt-BR'), cycle, state({ cycleNumber: 2, week: 3 }))).toBe(
      'Ciclo 2 · Semana de carga 3 de 6',
    );
  });

  it('counts one deload week for a manual deload on a plan without deload weeks', () => {
    expect(
      cycleStatusText(tFor('en'), { ...cycle, deloadWeeks: 0 }, state({ phase: 'deload' })),
    ).toBe('Cycle 1 · Deload week 1 of 1');
  });
});

describe('adviceText', () => {
  it('has a sentence for every advice that is shown', () => {
    const t = tFor('en');
    expect(adviceText(t, { kind: 'upcoming' })).toBe('The deload starts after this week.');
    expect(adviceText(t, { kind: 'inDeload' })).toBe('Deload week: lighter sets and loads so you recover.');
    expect(adviceText(t, { kind: 'early', stalledExerciseIds: ['a'] })).toBe(
      'Progress has stalled on 1 exercise. Consider a deload now.',
    );
    expect(adviceText(t, { kind: 'early', stalledExerciseIds: ['a', 'b'] })).toBe(
      'Progress has stalled on 2 exercises. Consider a deload now.',
    );
    expect(adviceText(t, { kind: 'none' })).toBeNull();
  });
});
