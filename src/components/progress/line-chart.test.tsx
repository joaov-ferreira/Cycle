import { fireEvent, screen } from '@testing-library/react-native';

import type { LanguageSetting } from '@/i18n/locale';
import { renderInApp } from '@/test-utils/render-app';

import { LineChart, type LineChartProps } from './line-chart';

const NBSP = ' ';
const NOW = new Date('2026-11-05T12:00:00.000Z');
const at = (iso: string) => `${iso}T12:00:00.000Z`;

const base: LineChartProps = {
  lift: 'bench',
  period: '4w',
  now: NOW,
  e1rms: [
    { id: 4, at: at('2026-10-22'), valueKg: 90.5 },
    { id: 5, at: at('2026-11-05'), valueKg: 91 },
  ],
  references: [{ at: at('2026-10-01'), valueKg: 90 }],
  sessionLabels: new Map([
    [4, 'Session 1, week 2 · 5/3/1 (custom)'],
    [5, 'Session 2, week 3 · 5/3/1 (custom)'],
  ]),
};

async function renderChart(props: Partial<LineChartProps> = {}, language: LanguageSetting = 'en') {
  await renderInApp(<LineChart {...base} {...props} />, { language });
}

describe('LineChart', () => {
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
      e1rms: [
        { id: 1, at: at('2025-01-10'), valueKg: 80 },
        { id: 2, at: at('2026-11-05'), valueKg: 100 },
      ],
      references: [{ at: at('2025-01-01'), valueKg: 75 }],
    });
    expect(screen.getByText('Jan 2025')).toBeOnTheScreen();
    expect(screen.getByText('Nov 2026')).toBeOnTheScreen();
  });

  it('describes the chart for assistive technology', async () => {
    await renderChart();
    expect(screen.getByLabelText('Bench Press e1RM chart')).toBeOnTheScreen();
    expect(
      screen.getByLabelText(`Bench Press, the last 4 weeks: 2 e1RM estimates, latest 91.0${NBSP}kg on Nov 5, 2026.`),
    ).toBeOnTheScreen();
  });

  it('describes the chart in Portuguese', async () => {
    await renderChart({}, 'pt-BR');
    expect(
      screen.getByLabelText(`Supino, as últimas 4 semanas: 2 estimativas de e1RM, a última de 91,0${NBSP}kg em 5 de nov. de 2026.`),
    ).toBeOnTheScreen();
  });

  it('exposes one accessible button per point, with its date and value', async () => {
    await renderChart();
    expect(screen.getByRole('button', { name: `Oct 22, 2026: e1RM ≈ 90.5${NBSP}kg` })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `Nov 5, 2026: e1RM ≈ 91.0${NBSP}kg` })).toBeOnTheScreen();
  });

  it('shows a hint until a point is selected, then its date, value and session', async () => {
    await renderChart();
    expect(screen.getByText('Tap or hover a point to see its date, value and session.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: `Oct 22, 2026: e1RM ≈ 90.5${NBSP}kg` }));
    expect(screen.getByText(`Oct 22, 2026 · e1RM ≈ 90.5${NBSP}kg (estimate)`)).toBeOnTheScreen();
    expect(screen.getByText('Session 1, week 2 · 5/3/1 (custom)')).toBeOnTheScreen();
    expect(screen.queryByText('Tap or hover a point to see its date, value and session.')).toBeNull();
    expect(screen.getByRole('button', { name: `Oct 22, 2026: e1RM ≈ 90.5${NBSP}kg`, selected: true })).toBeOnTheScreen();
  });

  it('moves the tooltip to another point and clears it on a second press', async () => {
    await renderChart();
    await fireEvent.press(screen.getByRole('button', { name: `Oct 22, 2026: e1RM ≈ 90.5${NBSP}kg` }));
    await fireEvent.press(screen.getByRole('button', { name: `Nov 5, 2026: e1RM ≈ 91.0${NBSP}kg` }));
    expect(screen.getByText(`Nov 5, 2026 · e1RM ≈ 91.0${NBSP}kg (estimate)`)).toBeOnTheScreen();
    expect(screen.queryByText(/Oct 22, 2026 ·/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: `Nov 5, 2026: e1RM ≈ 91.0${NBSP}kg` }));
    expect(screen.getByText('Tap or hover a point to see its date, value and session.')).toBeOnTheScreen();
  });

  it('shows the tooltip on hover', async () => {
    await renderChart();
    await fireEvent(screen.getByRole('button', { name: `Nov 5, 2026: e1RM ≈ 91.0${NBSP}kg` }), 'hoverIn');
    expect(screen.getByText(`Nov 5, 2026 · e1RM ≈ 91.0${NBSP}kg (estimate)`)).toBeOnTheScreen();
  });

  it('formats the tooltip in pt-BR', async () => {
    await renderChart({ sessionLabels: new Map([[4, 'Sessão 1, semana 2 · 5/3/1']]) }, 'pt-BR');
    await fireEvent.press(screen.getByRole('button', { name: `22 de out. de 2026: e1RM ≈ 90,5${NBSP}kg` }));
    expect(screen.getByText(`22 de out. de 2026 · e1RM ≈ 90,5${NBSP}kg (estimativa)`)).toBeOnTheScreen();
    expect(screen.getByText('Sessão 1, semana 2 · 5/3/1')).toBeOnTheScreen();
  });

  it('omits the session line when the originating session is unknown', async () => {
    await renderChart({ sessionLabels: new Map() });
    await fireEvent.press(screen.getByRole('button', { name: `Oct 22, 2026: e1RM ≈ 90.5${NBSP}kg` }));
    expect(screen.getByText(`Oct 22, 2026 · e1RM ≈ 90.5${NBSP}kg (estimate)`)).toBeOnTheScreen();
    expect(screen.queryByText(/Session/)).toBeNull();
  });

  it('shows an empty state without any e1RM', async () => {
    await renderChart({ e1rms: [], references: [] });
    expect(
      screen.getByText('No e1RM yet for Bench Press. Complete a training session with RIR or RPE to see your progress here.'),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText('Bench Press e1RM chart')).toBeNull();
  });

  it('shows a period empty state when every e1RM is older than the period', async () => {
    await renderChart({ e1rms: [{ id: 1, at: at('2026-06-01'), valueKg: 80 }] });
    expect(screen.getByText('No e1RM for Bench Press in the last 4 weeks.')).toBeOnTheScreen();
  });

  it('shows the empty states in pt-BR', async () => {
    await renderChart({ e1rms: [], references: [] }, 'pt-BR');
    expect(
      screen.getByText('Ainda não há e1RM de Supino. Conclua um treino com RIR ou RPE para ver sua evolução aqui.'),
    ).toBeOnTheScreen();
  });

  it('lays the chart out at the measured width', async () => {
    await renderChart();
    const chart = screen.getByLabelText('Bench Press e1RM chart');
    const before = screen.getByRole('button', { name: `Nov 5, 2026: e1RM ≈ 91.0${NBSP}kg` });
    const leftOf = (node: typeof before) => (Array.isArray(node.props.style) ? Object.assign({}, ...node.props.style.flat()) : node.props.style).left;
    expect(leftOf(before)).toBe(320 - 12 - 22);
    await fireEvent(chart, 'layout', { nativeEvent: { layout: { width: 500, height: 240 } } });
    expect(leftOf(screen.getByRole('button', { name: `Nov 5, 2026: e1RM ≈ 91.0${NBSP}kg` }))).toBe(500 - 12 - 22);
  });
});
