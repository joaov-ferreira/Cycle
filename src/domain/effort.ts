/**
 * Effort scale of the logger (SPEC-v4 §3.3). Storage is always RIR; the RPE scale is a display
 * and input choice. Pure: no I/O, no display strings.
 */

export const EFFORT_SCALES = ['rir', 'rpe'] as const;
export type EffortScale = (typeof EFFORT_SCALES)[number];
export const DEFAULT_EFFORT_SCALE: EffortScale = 'rir';

export const isEffortScale = (value: unknown): value is EffortScale =>
  typeof value === 'string' && (EFFORT_SCALES as readonly string[]).includes(value);

/** Step of RIR (and RPE) values: half points. */
export const RIR_STEP = 0.5;

/** RPE of an RIR value: RPE = 10 − RIR. */
export const rpeFromRir = (rir: number): number => 10 - rir;

/** RIR of an RPE value: RIR = 10 − RPE. */
export const rirFromRpe = (rpe: number): number => 10 - rpe;

/** True for 0 to 10 in steps of 0.5. */
export const isValidRirValue = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= 10 && Number.isInteger(value * 2);
