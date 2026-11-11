/**
 * Strength dashboard (SPEC-v4 §8). Pure: works on e1RM estimates passed in, so it does not depend
 * on the e1RM formulas. Arithmetic runs on integer grams; percentages are rounded to 2 decimals.
 */
import { periodStart, type Period } from './period';
import { maxAt, maxHistory, type ReferenceMax } from './reference-max';

/** The strength estimate of one session of an exercise. */
export interface StrengthEstimate {
  workoutId: number;
  /** ISO 8601. */
  date: string;
  kg: number;
}

export interface StrengthInput {
  estimates: readonly StrengthEstimate[];
  references: readonly ReferenceMax[];
  exerciseId: string;
  period: Period;
  now: Date;
}

export interface StrengthChange {
  kg: number;
  percent: number;
}

export interface StrengthCard {
  /** The reference 1RM in effect at `now`. */
  reference: ReferenceMax | null;
  latest: StrengthEstimate | null;
  previous: StrengthEstimate | null;
  best: StrengthEstimate | null;
  /** latest − previous. */
  delta: StrengthChange | null;
  /** latest − baseline over the period. */
  improvement: (StrengthChange & { baselineKg: number }) | null;
}

export interface StrengthSeries {
  points: { date: string; kg: number; workoutId: number }[];
  steps: { date: string; kg: number }[];
}

const GRAMS_PER_KG = 1000;
const toGrams = (kg: number): number => Math.round(kg * GRAMS_PER_KG);

/** Change from `fromKg` to `toKg`; the percentage is of `fromKg`, half away from zero. */
function change(fromKg: number, toKg: number): StrengthChange {
  const from = toGrams(fromKg);
  const delta = toGrams(toKg) - from;
  const hundredths = Math.floor((2 * Math.abs(delta) * 10_000 + from) / (2 * from));
  return { kg: delta / GRAMS_PER_KG, percent: (Math.sign(delta) * hundredths) / 100 };
}

/** Estimates inside the period, oldest first (ties by workout id). */
function inPeriod(input: StrengthInput): StrengthEstimate[] {
  const start = periodStart(input.period, input.now);
  const from = start === null ? -Infinity : start.getTime();
  return input.estimates
    .filter((e) => Date.parse(e.date) >= from)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date) || a.workoutId - b.workoutId);
}

/** Records up to `now`, oldest first. */
function recordsUntilNow(input: StrengthInput): ReferenceMax[] {
  return maxHistory(input.references, input.exerciseId)
    .filter((r) => Date.parse(r.effectiveAt) <= input.now.getTime())
    .reverse();
}

export function strengthCard(input: StrengthInput): StrengthCard {
  const { references, exerciseId, period, now } = input;
  const estimates = inPeriod(input);
  const latest = estimates[estimates.length - 1] ?? null;
  const previous = estimates[estimates.length - 2] ?? null;
  const best = estimates.reduce<StrengthEstimate | null>(
    (top, e) => (top === null || e.kg >= top.kg ? e : top),
    null,
  );

  const history = recordsUntilNow(input);
  const start = periodStart(period, now);
  const baseline =
    (start === null ? null : maxAt(references, exerciseId, start.toISOString())) ?? history[0] ?? null;

  return {
    reference: history[history.length - 1] ?? null,
    latest,
    previous,
    best,
    delta: latest && previous ? change(previous.kg, latest.kg) : null,
    improvement:
      latest && baseline ? { ...change(baseline.kg, latest.kg), baselineKg: baseline.kg } : null,
  };
}

export function strengthSeries(input: StrengthInput): StrengthSeries {
  const points = inPeriod(input).map((e) => ({ date: e.date, kg: e.kg, workoutId: e.workoutId }));

  const start = periodStart(input.period, input.now);
  const startMs = start === null ? -Infinity : start.getTime();
  const steps: StrengthSeries['steps'] = [];
  const inEffect = start === null ? null : maxAt(input.references, input.exerciseId, start.toISOString());
  if (inEffect && start) steps.push({ date: start.toISOString(), kg: inEffect.kg });
  for (const r of recordsUntilNow(input)) {
    if (Date.parse(r.effectiveAt) >= startMs && r !== inEffect) steps.push({ date: r.effectiveAt, kg: r.kg });
  }
  return { points, steps };
}
