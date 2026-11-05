/**
 * The Reactive Training Systems (RTS) RPE chart by Mike Tuchscherer: percent of 1RM for a set of
 * `reps` (1–12) at an RPE from 10 down to 6 in half points (SPEC §8.1, formula `rts`).
 *
 * Source of record (accessed 2026-11-05): the widely circulated Tuchscherer chart, identical on SensAI
 * (https://www.sensai.fit/tools/rpe), AIFitHub
 * (https://aifithub-monorepo.pages.dev/methodology/rpe-to-percentage-converter/) and Fitness Volt
 * (https://fitnessvolt.com/rpe-training/; reps 1–10 also on
 * https://fitnessvolt.com/rpe-training/guides/tuchscherer-chart-explained) in every cell but one:
 * 12 reps @ RPE 6 is 57.2 % on SensAI and AIFitHub and 57.4 % on Fitness Volt, so that cell is
 * `'unverified'` and produces no estimate (`RTS_UNVERIFIED`). The 2008 printing of *The Reactive
 * Training Manual* could not be retrieved (the elitefts.com excerpt of chapter 2 refers to the chart
 * without its values).
 *
 * Discrepancy note: the later RTS TRAC table ("pulled from the TRAC system on Reactive Training
 * Systems in Dec 2025" by the `strength` R package 0.1.0.9000, data set `rpe_tab_rts`,
 * https://alexpaynter.r-universe.dev/strength) is a different, revised version of the chart. It
 * differs in 44 cells (0.1 point at 93.9/93.8 and 79.9/79.8, and a flatter curve beyond 10 reps to
 * failure); those cells are listed in `RTS_TRAC_DIFFERENCES` and do not change the chart. Pure data.
 */

export type RtsCell = number | 'unverified';

const U = 'unverified' as const;

/** Column order of `RTS_TABLE`. */
export const RTS_RPE_COLUMNS = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6] as const;

export const RTS_MAX_REPS = 12;

/** `RTS_TABLE[reps − 1][column]`: percent of 1RM (83.7 = 83.7 %), columns as `RTS_RPE_COLUMNS`. */
export const RTS_TABLE: readonly (readonly RtsCell[])[] = [
  //  RPE 10  9.5   9     8.5   8     7.5   7     6.5   6
  [100.0, 97.8, 95.5, 93.9, 92.2, 90.7, 89.2, 87.8, 86.3], // 1 rep
  [95.5, 93.9, 92.2, 90.7, 89.2, 87.8, 86.3, 85.0, 83.7], // 2 reps
  [92.2, 90.7, 89.2, 87.8, 86.3, 85.0, 83.7, 82.4, 81.1], // 3 reps
  [89.2, 87.8, 86.3, 85.0, 83.7, 82.4, 81.1, 79.9, 78.6], // 4 reps
  [86.3, 85.0, 83.7, 82.4, 81.1, 79.9, 78.6, 77.4, 76.2], // 5 reps
  [83.7, 82.4, 81.1, 79.9, 78.6, 77.4, 76.2, 75.1, 73.9], // 6 reps
  [81.1, 79.9, 78.6, 77.4, 76.2, 75.1, 73.9, 72.3, 70.7], // 7 reps
  [78.6, 77.4, 76.2, 75.1, 73.9, 72.3, 70.7, 69.4, 68.0], // 8 reps
  [76.2, 75.1, 73.9, 72.3, 70.7, 69.4, 68.0, 66.7, 65.3], // 9 reps
  [73.9, 72.3, 70.7, 69.4, 68.0, 66.7, 65.3, 64.0, 62.6], // 10 reps
  [70.7, 69.4, 68.0, 66.7, 65.3, 64.0, 62.6, 61.3, 59.9], // 11 reps
  [68.0, 66.7, 65.3, 64.0, 62.6, 61.3, 59.9, 58.6, U], // 12 reps
];

/** Cells on which the circulated-chart sources disagree (`<reps>@<rpe>`: their readings). */
export const RTS_UNVERIFIED: Readonly<Record<string, readonly number[]>> = {
  '12@6': [57.2, 57.4],
};

/**
 * Discrepancy note, not used for estimates: cells where the RTS TRAC table (Dec 2025) differs from
 * the chart, as `[chart, TRAC]` (`null` where the chart cell is unverified).
 */
export const RTS_TRAC_DIFFERENCES: Readonly<Record<string, readonly [number | null, number]>> = {
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
  '12@6': [null, 65.0],
};

export const RTS_SOURCE = {
  author: 'Mike Tuchscherer (Reactive Training Systems)',
  reference:
    'RTS RPE chart (M. Tuchscherer, The Reactive Training Manual, 2008; printed original not retrieved), ' +
    'as circulated identically by SensAI, AIFitHub and Fitness Volt.',
  urls: [
    'https://www.sensai.fit/tools/rpe',
    'https://aifithub-monorepo.pages.dev/methodology/rpe-to-percentage-converter/',
    'https://fitnessvolt.com/rpe-training/',
    'https://fitnessvolt.com/rpe-training/guides/tuchscherer-chart-explained',
  ],
  accessedAt: '2026-11-05',
  notes:
    '12 reps @ RPE 6 is unverified (57.2 % SensAI/AIFitHub vs 57.4 % Fitness Volt). The later RTS TRAC table ' +
    '(strength R package, rpe_tab_rts, Dec 2025, https://alexpaynter.r-universe.dev/strength) differs in 44 ' +
    'cells (RTS_TRAC_DIFFERENCES); it is a revised version and is not adopted. The Fitness Volt RPE ' +
    'calculator page (https://fitnessvolt.com/rpe-calculator/) shows yet another curve beyond 10 reps to ' +
    'failure, inconsistent with the site\'s own chart page; not adopted.',
} as const;

/**
 * Percent of 1RM for `reps` at `rpe`: the chart cell, `'unverified'` when the sources disagree,
 * or `null` outside the chart (reps not an integer 1–12, RPE not 6–10 in half points).
 */
export function rtsPercent(reps: number, rpe: number): RtsCell | null {
  if (!Number.isInteger(reps) || reps < 1 || reps > RTS_MAX_REPS) return null;
  const column = RTS_RPE_COLUMNS.indexOf(rpe as (typeof RTS_RPE_COLUMNS)[number]);
  return column < 0 ? null : RTS_TABLE[reps - 1][column];
}
