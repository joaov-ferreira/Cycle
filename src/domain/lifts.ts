/** The three main lifts (SPEC §0), in display order. */
export const LIFTS = ['bench', 'squat', 'deadlift'] as const;

export type Lift = (typeof LIFTS)[number];

export function isLift(value: unknown): value is Lift {
  return typeof value === 'string' && (LIFTS as readonly string[]).includes(value);
}
