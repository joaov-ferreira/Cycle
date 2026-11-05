/**
 * Pure scale and layout logic of the progression chart (SPEC §9): "nice" axis ticks, linear
 * scales and `buildChartModel`, which turns one lift's e1RM and reference-1RM history plus the
 * period filter into pixel coordinates. The chart component only draws this model.
 */
import { periodStart, type Dated, type Period } from './stats';

const MS_PER_DAY = 86_400_000;
/** The shortest time axis: two days. */
const MIN_X_SPAN_MS = 2 * MS_PER_DAY;

export type NiceTicks = { min: number; max: number; ticks: number[] };

/** Rounds `value` to a 1, 2, 5 or 10 times a power of ten (`round`: nearest, else the next up). */
function niceNumber(value: number, round: boolean): number {
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  let nice: number;
  if (round) nice = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
  else nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * 10 ** exponent;
}

/** A value on its own is padded by this much on each side so the axis has a span. */
const SINGLE_VALUE_PADDING = 5;

/**
 * Evenly spaced round tick values covering `[min, max]` (about `targetCount` of them); the
 * returned `min` / `max` are the first and last tick, so they are the axis domain.
 */
export function niceTicks(min: number, max: number, targetCount = 5): NiceTicks {
  if (min === max) {
    min -= SINGLE_VALUE_PADDING;
    max += SINGLE_VALUE_PADDING;
  }
  const range = niceNumber(max - min, false);
  const step = niceNumber(range / (targetCount - 1), true);
  // Work in whole steps and fix the decimals afterwards, so 0.1 + 0.2 never shows up as a tick.
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  const first = Math.floor(min / step);
  const last = Math.ceil(max / step);
  const ticks: number[] = [];
  for (let index = first; index <= last; index += 1) ticks.push(Number((index * step).toFixed(decimals)));
  return { min: ticks[0], max: ticks[ticks.length - 1], ticks };
}

/** Linear map from a domain to a range (may be inverted); a degenerate domain maps to the middle. */
export function linearScale(
  [domainMin, domainMax]: readonly [number, number],
  [rangeStart, rangeEnd]: readonly [number, number],
): (value: number) => number {
  if (domainMin === domainMax) return () => (rangeStart + rangeEnd) / 2;
  return (value) => rangeStart + ((value - domainMin) / (domainMax - domainMin)) * (rangeEnd - rangeStart);
}

/** `count` evenly spaced timestamps from `start` to `end`, both included. */
export function timeTicks(start: number, end: number, count: number): number[] {
  return Array.from({ length: count }, (_, index) => start + ((end - start) * index) / (count - 1));
}

export type ChartLayout = {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
};

export type ChartE1rm = Dated & { id: number };

export type ChartPoint = ChartE1rm & { x: number; y: number };

export type ChartModel = {
  /** True when no e1RM falls inside the period: there is nothing to draw. */
  empty: boolean;
  plot: { left: number; right: number; top: number; bottom: number };
  /** Time domain in milliseconds. */
  xDomain: [number, number];
  yDomain: [number, number];
  xTicks: { time: number; x: number }[];
  yTicks: { value: number; y: number }[];
  /** The e1RM line, oldest first. */
  points: ChartPoint[];
  /** Vertices of the reference-1RM step line. */
  referenceSteps: { x: number; y: number }[];
};

export type ChartModelInput = {
  e1rms: readonly ChartE1rm[];
  references: readonly Dated[];
  period: Period;
  now: Date;
  layout: ChartLayout;
  xTickCount?: number;
  yTickCount?: number;
};

type Step = { time: number; valueKg: number };

/** The reference-1RM steps visible in `[start, end]`: the value in effect at `start`, then each change. */
function visibleSteps(references: readonly Dated[], start: number, end: number): Step[] {
  const sorted = references
    .map((reference, index) => ({ time: Date.parse(reference.at), valueKg: reference.valueKg, index }))
    .sort((a, b) => a.time - b.time || a.index - b.index);
  const before = sorted.filter((step) => step.time <= start);
  const inside = sorted.filter((step) => step.time > start && step.time <= end);
  const carried = before.length > 0 ? [{ time: start, valueKg: before[before.length - 1].valueKg }] : [];
  return [...carried, ...inside];
}

export function buildChartModel({
  e1rms,
  references,
  period,
  now,
  layout,
  xTickCount = 3,
  yTickCount = 5,
}: ChartModelInput): ChartModel {
  const plot = {
    left: layout.padding.left,
    right: layout.width - layout.padding.right,
    top: layout.padding.top,
    bottom: layout.height - layout.padding.bottom,
  };
  const startDate = periodStart(period, now);
  const inPeriod = e1rms
    .map((entry, index) => ({ entry, index, time: Date.parse(entry.at) }))
    .filter(({ time }) => startDate === null || time >= startDate.getTime())
    .sort((a, b) => a.time - b.time || a.index - b.index);

  if (inPeriod.length === 0) {
    return { empty: true, plot, xDomain: [0, 0], yDomain: [0, 0], xTicks: [], yTicks: [], points: [], referenceSteps: [] };
  }

  const lastPoint = inPeriod[inPeriod.length - 1].time;
  let start: number;
  let end: number;
  if (startDate !== null) {
    start = startDate.getTime();
    end = Math.max(now.getTime(), lastPoint);
  } else {
    const times = [...inPeriod.map(({ time }) => time), ...references.map((reference) => Date.parse(reference.at))];
    start = Math.min(...times);
    end = Math.max(...times);
  }
  // A span shorter than two days (a single instant, or a first session a few minutes after the
  // onboarding 1RM) is widened to one day each side of its centre, so the time ticks show distinct dates.
  if (end - start < MIN_X_SPAN_MS) {
    const centre = (start + end) / 2;
    start = centre - MIN_X_SPAN_MS / 2;
    end = centre + MIN_X_SPAN_MS / 2;
  }

  const steps = visibleSteps(references, start, end);
  const values = [...inPeriod.map(({ entry }) => entry.valueKg), ...steps.map((step) => step.valueKg)];
  const ticks = niceTicks(Math.min(...values), Math.max(...values), yTickCount);

  const xScale = linearScale([start, end], [plot.left, plot.right]);
  const yScale = linearScale([ticks.min, ticks.max], [plot.bottom, plot.top]);

  const referenceSteps: { x: number; y: number }[] = [];
  steps.forEach((step, index) => {
    const x = xScale(step.time);
    if (index > 0) referenceSteps.push({ x, y: yScale(steps[index - 1].valueKg) });
    referenceSteps.push({ x, y: yScale(step.valueKg) });
  });
  if (steps.length > 0) referenceSteps.push({ x: plot.right, y: yScale(steps[steps.length - 1].valueKg) });

  return {
    empty: false,
    plot,
    xDomain: [start, end],
    yDomain: [ticks.min, ticks.max],
    xTicks: timeTicks(start, end, xTickCount).map((time) => ({ time, x: xScale(time) })),
    yTicks: ticks.ticks.map((value) => ({ value, y: yScale(value) })),
    points: inPeriod.map(({ entry, time }) => ({ ...entry, x: xScale(time), y: yScale(entry.valueKg) })),
    referenceSteps,
  };
}
