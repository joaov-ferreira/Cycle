/**
 * Data test for the RTS (Tuchscherer) RPE chart: every cell, row by row, against the widely
 * circulated chart cited in `rts-table.ts` (SensAI, AIFitHub, Fitness Volt; see docs/DECISIONS.md,
 * Stage 11 revision). `U` marks the only cell on which those sources disagree.
 */
import {
  RTS_MAX_REPS,
  RTS_RPE_COLUMNS,
  RTS_SOURCE,
  RTS_TABLE,
  RTS_TRAC_DIFFERENCES,
  RTS_UNVERIFIED,
  rtsPercent,
} from './rts-table';

const U = 'unverified';

//            RPE: 10     9.5    9      8.5    8      7.5    7      6.5    6
const expected = [
  /*  1 rep  */ [100.0, 97.8, 95.5, 93.9, 92.2, 90.7, 89.2, 87.8, 86.3],
  /*  2 reps */ [95.5, 93.9, 92.2, 90.7, 89.2, 87.8, 86.3, 85.0, 83.7],
  /*  3 reps */ [92.2, 90.7, 89.2, 87.8, 86.3, 85.0, 83.7, 82.4, 81.1],
  /*  4 reps */ [89.2, 87.8, 86.3, 85.0, 83.7, 82.4, 81.1, 79.9, 78.6],
  /*  5 reps */ [86.3, 85.0, 83.7, 82.4, 81.1, 79.9, 78.6, 77.4, 76.2],
  /*  6 reps */ [83.7, 82.4, 81.1, 79.9, 78.6, 77.4, 76.2, 75.1, 73.9],
  /*  7 reps */ [81.1, 79.9, 78.6, 77.4, 76.2, 75.1, 73.9, 72.3, 70.7],
  /*  8 reps */ [78.6, 77.4, 76.2, 75.1, 73.9, 72.3, 70.7, 69.4, 68.0],
  /*  9 reps */ [76.2, 75.1, 73.9, 72.3, 70.7, 69.4, 68.0, 66.7, 65.3],
  /* 10 reps */ [73.9, 72.3, 70.7, 69.4, 68.0, 66.7, 65.3, 64.0, 62.6],
  /* 11 reps */ [70.7, 69.4, 68.0, 66.7, 65.3, 64.0, 62.6, 61.3, 59.9],
  /* 12 reps */ [68.0, 66.7, 65.3, 64.0, 62.6, 61.3, 59.9, 58.6, U],
];

/** RTS TRAC (strength R package, Dec 2025) where it differs from the chart: `[chart, TRAC]`. */
const tracDifferences: Record<string, [number, number]> = {
  '1@8.5': [93.9, 93.8],
  '2@9.5': [93.9, 93.8],
  '4@6.5': [79.9, 79.8],
  '5@7.5': [79.9, 79.8],
  '6@8.5': [79.9, 79.8],
  '7@9.5': [79.9, 79.8],
  '7@6.5': [72.3, 73.2],
  '7@6': [70.7, 72.4],
  '8@7.5': [72.3, 73.2],
  '8@7': [70.7, 72.4],
  '8@6.5': [69.4, 71.6],
  '8@6': [68.0, 70.7],
  '9@8.5': [72.3, 73.2],
  '9@8': [70.7, 72.4],
  '9@7.5': [69.4, 71.6],
  '9@7': [68.0, 70.7],
  '9@6.5': [66.7, 69.9],
  '9@6': [65.3, 69.1],
  '10@9.5': [72.3, 73.2],
  '10@9': [70.7, 72.4],
  '10@8.5': [69.4, 71.6],
  '10@8': [68.0, 70.7],
  '10@7.5': [66.7, 69.9],
  '10@7': [65.3, 69.1],
  '10@6.5': [64.0, 68.3],
  '10@6': [62.6, 67.6],
  '11@10': [70.7, 72.4],
  '11@9.5': [69.4, 71.6],
  '11@9': [68.0, 70.7],
  '11@8.5': [66.7, 69.9],
  '11@8': [65.3, 69.1],
  '11@7.5': [64.0, 68.3],
  '11@7': [62.6, 67.6],
  '11@6.5': [61.3, 66.9],
  '11@6': [59.9, 66.3],
  '12@10': [68.0, 70.7],
  '12@9.5': [66.7, 69.9],
  '12@9': [65.3, 69.1],
  '12@8.5': [64.0, 68.3],
  '12@8': [62.6, 67.6],
  '12@7.5': [61.3, 66.9],
  '12@7': [59.9, 66.3],
  '12@6.5': [58.6, 65.7],
};

describe('RTS RPE chart transcription', () => {
  it('covers reps 1–12 and RPE 10 down to 6 in half points', () => {
    expect(RTS_MAX_REPS).toBe(12);
    expect(RTS_RPE_COLUMNS).toEqual([10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6]);
    expect(RTS_TABLE).toHaveLength(12);
    for (const row of RTS_TABLE) expect(row).toHaveLength(9);
  });

  it.each(expected.map((row, index) => [index + 1, row] as const))('row %i reps matches the circulated chart', (reps, row) => {
    expect(RTS_TABLE[reps - 1]).toEqual(row);
  });

  it('leaves only 12 reps @ RPE 6 unverified (57.2 % SensAI/AIFitHub vs 57.4 % Fitness Volt)', () => {
    expect(RTS_TABLE.flat().filter((cell) => cell === U)).toHaveLength(1);
    expect(RTS_UNVERIFIED).toEqual({ '12@6': [57.2, 57.4] });
  });

  it('records the cells where the later RTS TRAC table differs, without changing the chart', () => {
    expect(RTS_TRAC_DIFFERENCES).toEqual({ ...tracDifferences, '12@6': [null, 65.0] });
    for (const [key, [chart]] of Object.entries(tracDifferences)) {
      const [reps, rpe] = key.split('@').map(Number);
      expect(rtsPercent(reps, rpe)).toBe(chart);
    }
  });

  it('keeps the chart diagonal: one more rep at one RPE point higher gives the same percentage', () => {
    // pct(r, RPE) = pct(r + 1, RPE + 1): e.g. 5 reps @ 9 (83.7) = 6 reps @ 10 (83.7).
    for (let r = 1; r < 12; r += 1) {
      for (let c = 2; c < 9; c += 1) {
        const cell = RTS_TABLE[r - 1][c];
        const diagonal = RTS_TABLE[r][c - 2];
        if (cell !== U && diagonal !== U) expect(diagonal).toBe(cell);
      }
    }
  });

  it('cites its source', () => {
    expect(RTS_SOURCE.author).toBe('Mike Tuchscherer (Reactive Training Systems)');
    expect(RTS_SOURCE.accessedAt).toBe('2026-11-05');
    expect(RTS_SOURCE.urls).toEqual(
      expect.arrayContaining([
        'https://www.sensai.fit/tools/rpe',
        'https://aifithub-monorepo.pages.dev/methodology/rpe-to-percentage-converter/',
        'https://fitnessvolt.com/rpe-training/',
      ]),
    );
  });
});

describe('rtsPercent', () => {
  it('returns the chart cell (SPEC §8.1 example: 5 reps @ RPE 9 = 83.7%)', () => {
    expect(rtsPercent(5, 9)).toBe(83.7);
    expect(rtsPercent(1, 10)).toBe(100);
    expect(rtsPercent(10, 10)).toBe(73.9);
    expect(rtsPercent(6, 6)).toBe(73.9);
  });

  it('gives the circulated value where TRAC differs, and flags the unverified cell', () => {
    expect(rtsPercent(1, 8.5)).toBe(93.9);
    expect(rtsPercent(12, 10)).toBe(68.0);
    expect(rtsPercent(12, 6)).toBe(U);
  });

  it('returns null outside the chart', () => {
    expect(rtsPercent(0, 10)).toBeNull();
    expect(rtsPercent(13, 10)).toBeNull();
    expect(rtsPercent(5, 5.5)).toBeNull();
    expect(rtsPercent(5, 10.5)).toBeNull();
    expect(rtsPercent(5, 8.25)).toBeNull();
    expect(rtsPercent(2.5, 9)).toBeNull();
  });
});
