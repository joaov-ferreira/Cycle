/** Set-prescription types shared by percent schemes and program days (SPEC-v4 §5.1). Types only. */
export interface SchemeSet {
  /** Integer 1–100; the minimum when `amrap`. */
  reps: number;
  /** Percent of the reference 1RM: 1–120 in steps of 0.5. Absent = no load can be calculated. */
  percent?: number;
  /** Kilograms added after the percentage: −100…100, at most 2 decimals. Default 0. */
  addKg?: number;
  /** Number of identical sets, integer 1–20. Default 1. */
  repeat?: number;
  amrap?: boolean;
  unverified?: boolean;
}

/** One week of a scheme; an empty `sets` means the exercise is not trained that week. */
export interface SchemeWeek {
  sets: SchemeSet[];
}
