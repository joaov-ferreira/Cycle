import { DEFAULT_TRAINING_FOCUS, isTrainingFocus, TRAINING_FOCUSES } from './focus';

describe('training focus', () => {
  it('lists general and strength, general first', () => {
    expect(TRAINING_FOCUSES).toEqual(['general', 'strength']);
    expect(DEFAULT_TRAINING_FOCUS).toBe('general');
  });

  it('recognizes only the known values', () => {
    expect(isTrainingFocus('general')).toBe(true);
    expect(isTrainingFocus('strength')).toBe(true);
    expect(isTrainingFocus('hypertrophy')).toBe(false);
    expect(isTrainingFocus('')).toBe(false);
    expect(isTrainingFocus(null)).toBe(false);
    expect(isTrainingFocus(1)).toBe(false);
  });
});
