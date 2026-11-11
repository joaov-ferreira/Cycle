import { fireEvent, screen } from '@testing-library/react-native';

import type { LanguageSetting } from '@/i18n/locale';
import { renderInApp } from '@/test-utils/render-app';

import { LineChart, type LineChartProps } from './line-chart';

const NBSP = ' ';
const NOW = new Date('2026-11-05T12:00:00.000Z');
const at = (iso: string) => `${iso}T12:00:00.000Z`;

const base: LineChartProps = {
  label: 'Bench Press load',
  seriesLabel: 'Top set load',
  referenceLabel: 'Target',
  period: '4w',
  now: NOW,
  series: [
    { id: 4, at: at('2026-10-22'), value: 90.5 },
    { id: 5, at: at('2026-11-05'), value: 91 },
  ],
  references: [{ at: at('2026-10-01'), value: 90 }],
  detailLabels: new Map([
    [4, 'Workout of week 2'],
    [5, 'Workout of week 3'],
  ]),
};

async function renderChart(props: Partial<LineChartProps> = {}, language: LanguageSetting = 'en') {
  await renderInApp(<LineChart {...base} {...props} />, { language });
}

describe('LineChart', () => {
  it('keeps the unit label above the top tick label (no overlap)', async () => {
    await renderChart();
    const flat = (node: ReturnType<typeof screen.getByText>) => Object.assign({}, ...[node.props.style].flat(Infinity));
    const unit = flat(screen.getByText('kg'));
    const topTick = flat(screen.getByText('91'));
    // the labels are one line of caption text (14 pt line box)
    expect(topTick.top - unit.top).toBeGreaterThanOrEqual(14);
  });

  it('labels the y axis with localized numbers (en)', async () => {
    await renderChart();
    for (const label of ['90', '90.2', '90.4', '90.6', '90.8', '91']) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
  });

  it('labels the y axis with localized numbers (pt-BR)', async () => {
    await renderChart({}, 'pt-BR');
    expect(screen.getByText('90,2')).toBeOnTheScreen();
    expect(screen.queryByText('90.2')).toBeNull();
  });

  it('labels the x axis with localized dates', async () => {
    await renderChart();
    for (const label of ['Oct 8', 'Oct 22', 'Nov 5']) expect(screen.getByText(label)).toBeOnTheScreen();
  });

  it('labels the x axis with localized dates (pt-BR)', async () => {
    await renderChart({}, 'pt-BR');
    for (const label of ['8 de out.', '22 de out.', '5 de nov.']) expect(screen.getByText(label)).toBeOnTheScreen();
  });

  it('uses months and years on the x axis for long periods', async () => {
    await renderChart({
      period: 'all',
      series: [
        { id: 1, at: at('2025-01-10'), value: 80 },
        { id: 2, at: at('2026-11-05'), value: 100 },
      ],
      references: [{ at: at('2025-01-01'), value: 75 }],
    });
    expect(screen.getByText('Jan 2025')).toBeOnTheScreen();
    expect(screen.getByText('Nov 2026')).toBeOnTheScreen();
  });

  it('describes the chart for assistive technology', async () => {
    await renderChart();
    expect(screen.getByLabelText('Bench Press load chart')).toBeOnTheScreen();
    expect(
      screen.getByLabelText(`Bench Press load, the last 4 weeks: 2 data points, latest 91.0${NBSP}kg on Nov 5, 2026.`),
    ).toBeOnTheScreen();
  });

  it('describes the chart in Portuguese', async () => {
    await renderChart({ label: 'Supino carga' }, 'pt-BR');
    expect(
      screen.getByLabelText(`Supino carga, as últimas 4 semanas: 2 pontos, o último de 91,0${NBSP}kg em 5 de nov. de 2026.`),
    ).toBeOnTheScreen();
  });

  it('exposes one accessible button per point, with its date and value', async () => {
    await renderChart();
    expect(screen.getByRole('button', { name: `Oct 22, 2026: 90.5${NBSP}kg` })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `Nov 5, 2026: 91.0${NBSP}kg` })).toBeOnTheScreen();
  });

  it('shows a hint until a point is selected, then its date, value and detail', async () => {
    await renderChart();
    expect(screen.getByText('Tap or hover a point to see its date and value.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: `Oct 22, 2026: 90.5${NBSP}kg` }));
    expect(screen.getByText(`Oct 22, 2026 · 90.5${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.getByText('Workout of week 2')).toBeOnTheScreen();
    expect(screen.queryByText('Tap or hover a point to see its date and value.')).toBeNull();
    expect(screen.getByRole('button', { name: `Oct 22, 2026: 90.5${NBSP}kg`, selected: true })).toBeOnTheScreen();
  });

  it('moves the tooltip to another point and clears it on a second press', async () => {
    await renderChart();
    await fireEvent.press(screen.getByRole('button', { name: `Oct 22, 2026: 90.5${NBSP}kg` }));
    await fireEvent.press(screen.getByRole('button', { name: `Nov 5, 2026: 91.0${NBSP}kg` }));
    expect(screen.getByText(`Nov 5, 2026 · 91.0${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.queryByText(/Oct 22, 2026 ·/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: `Nov 5, 2026: 91.0${NBSP}kg` }));
    expect(screen.getByText('Tap or hover a point to see its date and value.')).toBeOnTheScreen();
  });

  it('shows the tooltip on hover', async () => {
    await renderChart();
    await fireEvent(screen.getByRole('button', { name: `Nov 5, 2026: 91.0${NBSP}kg` }), 'hoverIn');
    expect(screen.getByText(`Nov 5, 2026 · 91.0${NBSP}kg`)).toBeOnTheScreen();
  });

  it('formats the tooltip in pt-BR', async () => {
    await renderChart({ detailLabels: new Map([[4, 'Treino da semana 2']]) }, 'pt-BR');
    await fireEvent.press(screen.getByRole('button', { name: `22 de out. de 2026: 90,5${NBSP}kg` }));
    expect(screen.getByText(`22 de out. de 2026 · 90,5${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.getByText('Treino da semana 2')).toBeOnTheScreen();
  });

  it('omits the detail line when a point has none', async () => {
    await renderChart({ detailLabels: new Map() });
    await fireEvent.press(screen.getByRole('button', { name: `Oct 22, 2026: 90.5${NBSP}kg` }));
    expect(screen.getByText(`Oct 22, 2026 · 90.5${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.queryByText(/Workout of/)).toBeNull();
  });

  it('shows an empty state without any data', async () => {
    await renderChart({ series: [], references: [] });
    expect(screen.getByText('No data yet for Bench Press load.')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Bench Press load chart')).toBeNull();
  });

  it('shows a period empty state when every entry is older than the period', async () => {
    await renderChart({ series: [{ id: 1, at: at('2026-06-01'), value: 80 }] });
    expect(screen.getByText('No data for Bench Press load in the last 4 weeks.')).toBeOnTheScreen();
  });

  it('shows the empty states in pt-BR', async () => {
    await renderChart({ series: [], references: [], label: 'Supino carga' }, 'pt-BR');
    expect(screen.getByText('Ainda não há dados de Supino carga.')).toBeOnTheScreen();
  });

  it('draws a legend for the labelled lines only', async () => {
    await renderChart();
    expect(screen.getByText('Top set load')).toBeOnTheScreen();
    expect(screen.getByText('Target')).toBeOnTheScreen();
  });

  it('omits the legend entries without a label', async () => {
    await renderChart({ seriesLabel: undefined, referenceLabel: undefined });
    expect(screen.queryByText('Top set load')).toBeNull();
    expect(screen.queryByText('Target')).toBeNull();
  });

  it('lays the chart out at the measured width', async () => {
    await renderChart();
    const chart = screen.getByLabelText('Bench Press load chart');
    const before = screen.getByRole('button', { name: `Nov 5, 2026: 91.0${NBSP}kg` });
    const leftOf = (node: typeof before) => (Array.isArray(node.props.style) ? Object.assign({}, ...node.props.style.flat()) : node.props.style).left;
    expect(leftOf(before)).toBe(320 - 12 - 22);
    await fireEvent(chart, 'layout', { nativeEvent: { layout: { width: 500, height: 240 } } });
    expect(leftOf(screen.getByRole('button', { name: `Nov 5, 2026: 91.0${NBSP}kg` }))).toBe(500 - 12 - 22);
  });
});
