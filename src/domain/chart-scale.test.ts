import { buildChartModel, linearScale, niceTicks, timeTicks, type ChartLayout } from './chart-scale';

describe('niceTicks', () => {
  it.each([
    [90, 102, [90, 95, 100, 105]],
    [100, 200, [100, 120, 140, 160, 180, 200]],
    [92.9, 96.5, [92, 93, 94, 95, 96, 97]],
    [96, 105, [96, 98, 100, 102, 104, 106]],
    [0, 1, [0, 0.2, 0.4, 0.6, 0.8, 1]],
  ])('ticks for %d to %d', (min, max, ticks) => {
    const result = niceTicks(min, max);
    expect(result.ticks).toEqual(ticks);
    expect(result.min).toBe(ticks[0]);
    expect(result.max).toBe(ticks[ticks.length - 1]);
  });

  it('pads a single value by 5 on each side before rounding', () => {
    expect(niceTicks(96, 96).ticks).toEqual([90, 92, 94, 96, 98, 100, 102]);
  });

  it('honours the target tick count', () => {
    expect(niceTicks(0, 100, 3).ticks).toEqual([0, 50, 100]);
  });
});

describe('linearScale', () => {
  it('maps the domain onto the range, also inverted', () => {
    expect(linearScale([0, 10], [40, 140])(5)).toBe(90);
    expect(linearScale([96, 106], [170, 10])(101)).toBe(90);
  });

  it('maps a degenerate domain to the middle of the range', () => {
    expect(linearScale([5, 5], [0, 100])(5)).toBe(50);
  });
});

describe('timeTicks', () => {
  it('spreads ticks evenly including both ends', () => {
    expect(timeTicks(0, 100, 3)).toEqual([0, 50, 100]);
    expect(timeTicks(0, 90, 4)).toEqual([0, 30, 60, 90]);
  });
});

const layout: ChartLayout = { width: 300, height: 200, padding: { top: 10, right: 10, bottom: 30, left: 40 } };
const NOW = new Date('2026-11-05T12:00:00.000Z');
const at = (iso: string) => `${iso}T12:00:00.000Z`;

describe('buildChartModel', () => {
  it('is empty when there is no e1RM in the period', () => {
    const model = buildChartModel({
      e1rms: [{ id: 1, at: at('2026-08-01'), valueKg: 96 }],
      references: [{ at: at('2026-07-01'), valueKg: 100 }],
      period: '4w',
      now: NOW,
      layout,
    });
    expect(model.empty).toBe(true);
    expect(model.points).toEqual([]);
    expect(model.referenceSteps).toEqual([]);
  });

  it('is empty without any history', () => {
    const model = buildChartModel({ e1rms: [], references: [], period: 'all', now: NOW, layout });
    expect(model.empty).toBe(true);
    expect(model.yTicks).toEqual([]);
    expect(model.xTicks).toEqual([]);
  });

  it('places a 4-week chart on the plot area (carry-in reference, no change)', () => {
    const model = buildChartModel({
      e1rms: [
        { id: 7, at: at('2026-09-01'), valueKg: 90 },
        { id: 8, at: at('2026-10-22'), valueKg: 96 },
        { id: 9, at: at('2026-11-05'), valueKg: 102 },
      ],
      references: [{ at: at('2026-10-01'), valueKg: 105 }],
      period: '4w',
      now: NOW,
      layout,
    });
    expect(model.empty).toBe(false);
    expect(model.plot).toEqual({ left: 40, right: 290, top: 10, bottom: 170 });
    expect(model.xDomain).toEqual([Date.parse(at('2026-10-08')), Date.parse(at('2026-11-05'))]);
    expect(model.yDomain).toEqual([96, 106]);
    // only the two e1RMs inside the period are drawn: 14 and 28 days after the start
    expect(model.points).toEqual([
      { id: 8, at: at('2026-10-22'), valueKg: 96, x: 165, y: 170 },
      { id: 9, at: at('2026-11-05'), valueKg: 102, x: 290, y: 74 },
    ]);
    expect(model.referenceSteps).toEqual([
      { x: 40, y: 26 },
      { x: 290, y: 26 },
    ]);
    expect(model.yTicks.map((tick) => tick.value)).toEqual([96, 98, 100, 102, 104, 106]);
    expect(model.yTicks[0]).toEqual({ value: 96, y: 170 });
    expect(model.yTicks[5]).toEqual({ value: 106, y: 10 });
    expect(model.xTicks).toEqual([
      { time: Date.parse(at('2026-10-08')), x: 40 },
      { time: Date.parse(at('2026-10-22')), x: 165 },
      { time: Date.parse(at('2026-11-05')), x: 290 },
    ]);
  });

  it('draws a reference change as a step', () => {
    const model = buildChartModel({
      e1rms: [
        { id: 8, at: at('2026-10-22'), valueKg: 96 },
        { id: 9, at: at('2026-11-05'), valueKg: 102 },
      ],
      references: [
        { at: at('2026-10-01'), valueKg: 105 },
        { at: at('2026-10-29'), valueKg: 106 },
      ],
      period: '4w',
      now: NOW,
      layout,
    });
    // 21 of 28 days after the start: x = 40 + 250 * 21 / 28 = 227.5
    expect(model.referenceSteps).toEqual([
      { x: 40, y: 26 },
      { x: 227.5, y: 26 },
      { x: 227.5, y: 10 },
      { x: 290, y: 10 },
    ]);
  });

  it('starts the reference line at its own record when it began inside the period', () => {
    const model = buildChartModel({
      e1rms: [{ id: 8, at: at('2026-10-22'), valueKg: 96 }],
      references: [{ at: at('2026-10-22'), valueKg: 100 }],
      period: '4w',
      now: NOW,
      layout,
    });
    expect(model.referenceSteps).toEqual([
      { x: 165, y: expect.any(Number) },
      { x: 290, y: expect.any(Number) },
    ]);
  });

  it('spans the whole history for "all" and extends the last reference to the last record', () => {
    const model = buildChartModel({
      e1rms: [
        { id: 1, at: at('2026-09-10'), valueKg: 96 },
        { id: 2, at: at('2026-11-02'), valueKg: 102 },
      ],
      references: [
        { at: at('2026-08-01'), valueKg: 100 },
        { at: at('2026-10-01'), valueKg: 105 },
      ],
      period: 'all',
      now: NOW,
      layout,
    });
    // 93 days from 2026-08-01 to 2026-11-02; 2026-09-10 is day 40
    expect(model.xDomain).toEqual([Date.parse(at('2026-08-01')), Date.parse(at('2026-11-02'))]);
    expect(model.points[0].x).toBeCloseTo(40 + (250 * 40) / 93, 6);
    expect(model.points[1].x).toBe(290);
    expect(model.referenceSteps.map((p) => p.x)).toEqual([
      40,
      expect.closeTo(40 + (250 * 61) / 93, 6),
      expect.closeTo(40 + (250 * 61) / 93, 6),
      290,
    ]);
    expect(model.yDomain).toEqual([96, 106]);
  });

  it('centres a single point (one day of padding on each side)', () => {
    const model = buildChartModel({
      e1rms: [{ id: 1, at: at('2026-10-20'), valueKg: 96 }],
      references: [],
      period: 'all',
      now: NOW,
      layout,
    });
    expect(model.points).toEqual([{ id: 1, at: at('2026-10-20'), valueKg: 96, x: 165, y: 90 }]);
    expect(model.referenceSteps).toEqual([]);
    expect(model.yDomain).toEqual([90, 102]);
  });
});
