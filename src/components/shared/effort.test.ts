import { displayEffort, storedRir } from './effort';

describe('displayEffort / storedRir', () => {
  it('shows RIR as stored', () => {
    expect(displayEffort('rir', 2)).toBe(2);
    expect(displayEffort('rir', 0.5)).toBe(0.5);
    expect(displayEffort('rir', null)).toBeNull();
    expect(storedRir('rir', 1.5)).toBe(1.5);
    expect(storedRir('rir', null)).toBeNull();
  });

  it('shows RPE as 10 - RIR and stores RIR as 10 - RPE', () => {
    expect(displayEffort('rpe', 2)).toBe(8);
    expect(displayEffort('rpe', 0.5)).toBe(9.5);
    expect(displayEffort('rpe', 10)).toBe(0);
    expect(displayEffort('rpe', null)).toBeNull();
    expect(storedRir('rpe', 8)).toBe(2);
    expect(storedRir('rpe', 9.5)).toBe(0.5);
    expect(storedRir('rpe', null)).toBeNull();
  });

  it('keeps off-step values off-step without float noise', () => {
    expect(storedRir('rpe', 7.3)).toBe(2.7);
    expect(displayEffort('rpe', 2.7)).toBe(7.3);
  });
});
