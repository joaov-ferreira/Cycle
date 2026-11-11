import {
  BAR_LIMITS,
  DEFAULT_BAR_KG,
  DEFAULT_PLATES_KG,
  platesPerSide,
  STANDARD_PLATES_KG,
} from './plates';

describe('plate constants (SPEC-v3 §2)', () => {
  it('lists the standard plates heaviest first', () => {
    expect(STANDARD_PLATES_KG).toEqual([25, 20, 15, 10, 5, 2.5, 1.25, 0.5]);
  });

  it('defaults to every standard plate except 0.5 kg', () => {
    expect(DEFAULT_PLATES_KG).toEqual([25, 20, 15, 10, 5, 2.5, 1.25]);
  });

  it('defaults to a 20 kg bar with 0–50 kg in steps of 0.5', () => {
    expect(DEFAULT_BAR_KG).toBe(20);
    expect(BAR_LIMITS).toEqual({ min: 0, max: 50, step: 0.5 });
  });
});

describe('platesPerSide (SPEC-v3 §2 table)', () => {
  const all = DEFAULT_PLATES_KG;

  it('100 kg on a 20 kg bar is 25 + 15 per side', () => {
    expect(platesPerSide(100, 20, all)).toEqual({
      status: 'ok',
      plates: [
        { kg: 25, count: 1 },
        { kg: 15, count: 1 },
      ],
      achievedKg: 100,
      remainderKg: 0,
    });
  });

  it('62.5 kg on a 20 kg bar is 20 + 1.25 per side', () => {
    expect(platesPerSide(62.5, 20, all)).toEqual({
      status: 'ok',
      plates: [
        { kg: 20, count: 1 },
        { kg: 1.25, count: 1 },
      ],
      achievedKg: 62.5,
      remainderKg: 0,
    });
  });

  it('142.5 kg on a 20 kg bar is 2 × 25 + 10 + 1.25 per side', () => {
    expect(platesPerSide(142.5, 20, all)).toEqual({
      status: 'ok',
      plates: [
        { kg: 25, count: 2 },
        { kg: 10, count: 1 },
        { kg: 1.25, count: 1 },
      ],
      achievedKg: 142.5,
      remainderKg: 0,
    });
  });

  it('43 kg leaves 0.5 kg when the 0.5 kg plate is not available', () => {
    // Per side 11.5 = 10 + 1.25, 0.25 left over; 2 × 0.25 = 0.5 kg in total.
    expect(platesPerSide(43, 20, all)).toEqual({
      status: 'ok',
      plates: [
        { kg: 10, count: 1 },
        { kg: 1.25, count: 1 },
      ],
      achievedKg: 42.5,
      remainderKg: 0.5,
    });
  });

  it('the bar alone needs no plates', () => {
    expect(platesPerSide(20, 20, all)).toEqual({
      status: 'ok',
      plates: [],
      achievedKg: 20,
      remainderKg: 0,
    });
  });

  it('a target below the bar is belowBar', () => {
    expect(platesPerSide(15, 20, all)).toEqual({ status: 'belowBar' });
  });
});

describe('platesPerSide (more cases)', () => {
  it('uses only the available plates', () => {
    expect(platesPerSide(100, 20, [20, 10])).toEqual({
      status: 'ok',
      plates: [{ kg: 20, count: 2 }],
      achievedKg: 100,
      remainderKg: 0,
    });
  });

  it('reports what the available plates cannot load as the remainder', () => {
    // Per side 40 with only 15 kg plates: 2 × 15 = 30, 10 left per side = 20 kg in total.
    expect(platesPerSide(100, 20, [15])).toEqual({
      status: 'ok',
      plates: [{ kg: 15, count: 2 }],
      achievedKg: 80,
      remainderKg: 20,
    });
  });

  it('accepts the available plates in any order and ignores duplicates', () => {
    expect(platesPerSide(142.5, 20, [1.25, 10, 25, 10, 25])).toEqual(
      platesPerSide(142.5, 20, [25, 10, 1.25]),
    );
  });

  it('lists plates heaviest first even when the input is unsorted', () => {
    const result = platesPerSide(62.5, 20, [1.25, 20, 5]);
    expect(result).toEqual({
      status: 'ok',
      plates: [
        { kg: 20, count: 1 },
        { kg: 1.25, count: 1 },
      ],
      achievedKg: 62.5,
      remainderKg: 0,
    });
  });

  it('has no float artifacts: 61.25 per side is exact', () => {
    // 142.5 − 20 = 122.5, per side 61.25 kg; 0.1 + 0.2 style noise must not appear.
    const result = platesPerSide(142.5, 20, DEFAULT_PLATES_KG);
    expect(result).toMatchObject({ status: 'ok', achievedKg: 142.5, remainderKg: 0 });
  });

  it('keeps the remainder exact for fractional targets', () => {
    // Per side 0.3 kg (target 20.6 on a 20 bar): nothing lighter than 1.25 kg fits.
    // Remainder 0.6 kg in total, exactly.
    const result = platesPerSide(20.6, 20, DEFAULT_PLATES_KG);
    expect(result).toEqual({
      status: 'ok',
      plates: [],
      achievedKg: 20,
      remainderKg: 0.6,
    });
  });

  it('a zero bar loads plates by the target alone', () => {
    expect(platesPerSide(50, 0, [25, 20])).toEqual({
      status: 'ok',
      plates: [{ kg: 25, count: 1 }],
      achievedKg: 50,
      remainderKg: 0,
    });
  });
});
