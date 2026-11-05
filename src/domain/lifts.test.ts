import { isLift, LIFTS } from './lifts';

describe('lifts', () => {
  it('lists the three main lifts in display order', () => {
    expect(LIFTS).toEqual(['bench', 'squat', 'deadlift']);
  });

  it('recognizes lift ids', () => {
    expect(isLift('bench')).toBe(true);
    expect(isLift('deadlift')).toBe(true);
    expect(isLift('press')).toBe(false);
    expect(isLift(null)).toBe(false);
  });
});
