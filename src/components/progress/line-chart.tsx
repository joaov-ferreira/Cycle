import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent, type TextStyle } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { layout as uiLayout, spacing } from '@/constants/theme';
import { buildChartModel, type ChartEntry, type ChartLayout, type DatedValue } from '@/domain/chart-scale';
import type { Period } from '@/domain/period';
import { useI18n } from '@/i18n';

import { useTheme } from '../theme-provider';
import { Text } from '../ui';

export type LineChartProps = {
  /** Localized name of what is charted (e.g. an exercise), used in the accessible labels. */
  label: string;
  /** Localized legend text of the series line; no legend entry when omitted. */
  seriesLabel?: string;
  /** Localized legend text of the reference step line; no legend entry when omitted. */
  referenceLabel?: string;
  /** The charted values over time (kg), any order. */
  series: readonly ChartEntry[];
  /** Optional reference values over time (kg), drawn as a dashed step line, any order. */
  references?: readonly DatedValue[];
  period: Period;
  /** The clock, passed in so the chart is deterministic. */
  now: Date;
  /** Localized extra line shown under the selected point's tooltip, by entry id. */
  detailLabels?: ReadonlyMap<number, string>;
  height?: number;
};

const NO_REFERENCES: readonly DatedValue[] = [];
const NO_DETAILS: ReadonlyMap<number, string> = new Map();

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 220;
// top leaves a line for the unit label (`kg`) above the highest tick label
const PADDING = { top: 30, right: 12, bottom: 28, left: 44 };
const ONE_YEAR_MS = 365 * 86_400_000;
const AXIS_LINE = 14;
const X_LABEL_WIDTH = 96;
const HIT_SIZE = uiLayout.minTouchTarget;

/**
 * Line chart of a dated value series (kg) with a tappable / hoverable point each and an optional
 * reference step line. Drawn with `react-native-svg` from the pure `buildChartModel`; no animation.
 */
export function LineChart({
  label,
  seriesLabel,
  referenceLabel,
  series,
  references = NO_REFERENCES,
  period,
  now,
  detailLabels = NO_DETAILS,
  height = DEFAULT_HEIGHT,
}: LineChartProps) {
  const { t, formatKg, formatNumber, formatDate } = useI18n();
  const { colors } = useTheme();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const chartLayout: ChartLayout = useMemo(() => ({ width, height, padding: PADDING }), [width, height]);
  const model = useMemo(
    () => buildChartModel({ series, references, period, now, layout: chartLayout }),
    [series, references, period, now, chartLayout],
  );

  if (series.length === 0) return <Text tone="secondary">{t('progress.chart.empty', { label })}</Text>;
  if (model.empty) {
    return (
      <Text tone="secondary">
        {t('progress.chart.emptyPeriod', { label, period: t(`progress.periodNames.${period}`) })}
      </Text>
    );
  }

  const onLayout = (event: LayoutChangeEvent) => {
    const measured = Math.floor(event.nativeEvent.layout.width);
    if (measured > 0) setWidth(measured);
  };

  const { plot } = model;
  const longSpan = model.xDomain[1] - model.xDomain[0] > ONE_YEAR_MS;
  const xTickFormat: Intl.DateTimeFormatOptions = longSpan
    ? { month: 'short', year: 'numeric' }
    : { day: 'numeric', month: 'short' };
  const last = model.points[model.points.length - 1];
  const selected = model.points.find((point) => point.id === selectedId) ?? null;
  const formatValue = (kg: number) => formatKg(kg, { maximumFractionDigits: 1 });
  const pointDate = (at: string) => formatDate(new Date(at));
  const summary = t('progress.chart.summary', {
    label,
    period: t(`progress.periodNames.${period}`),
    count: model.points.length,
    latest: formatValue(last.value),
    date: pointDate(last.at),
  });

  return (
    <View style={styles.container}>
      <View accessibilityLabel={t('progress.chart.label', { label })} onLayout={onLayout} style={{ height }} testID="line-chart">
        <View accessibilityLabel={summary} style={StyleSheet.absoluteFill}>
          <Svg width={width} height={height}>
            {model.yTicks.map((tick) => (
              <Line key={`grid-${tick.value}`} x1={plot.left} x2={plot.right} y1={tick.y} y2={tick.y} stroke={colors.border} strokeWidth={1} />
            ))}
            {model.referenceSteps.length > 0 ? (
              <Polyline
                points={model.referenceSteps.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={colors.textSecondary}
                strokeWidth={2}
                strokeDasharray="6 4"
              />
            ) : null}
            <Polyline points={model.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={colors.text} strokeWidth={2} />
            {model.points.map((point) => (
              <Circle
                key={point.id}
                cx={point.x}
                cy={point.y}
                r={point.id === selectedId ? 6 : 3.5}
                fill={point.id === selectedId ? colors.accent : colors.text}
              />
            ))}
          </Svg>
        </View>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <AxisLabel style={{ left: 0, width: plot.left - 6, top: 0, textAlign: 'right' }}>{t('progress.chart.yAxis')}</AxisLabel>
          {model.yTicks.map((tick) => (
            <AxisLabel key={`y-${tick.value}`} style={{ left: 0, width: plot.left - 6, top: tick.y - AXIS_LINE / 2, textAlign: 'right' }}>
              {formatNumber(tick.value, { maximumFractionDigits: 1 })}
            </AxisLabel>
          ))}
          {model.xTicks.map((tick, index) => {
            const first = index === 0;
            const lastTick = index === model.xTicks.length - 1;
            return (
              <AxisLabel
                key={`x-${tick.time}`}
                style={{
                  top: plot.bottom + 6,
                  width: X_LABEL_WIDTH,
                  left: first ? tick.x : lastTick ? tick.x - X_LABEL_WIDTH : tick.x - X_LABEL_WIDTH / 2,
                  textAlign: first ? 'left' : lastTick ? 'right' : 'center',
                }}>
                {formatDate(new Date(tick.time), xTickFormat)}
              </AxisLabel>
            );
          })}
        </View>
        {model.points.map((point) => (
          <Pressable
            key={point.id}
            accessibilityRole="button"
            accessibilityLabel={t('progress.chart.point', { date: pointDate(point.at), value: formatValue(point.value) })}
            accessibilityState={{ selected: point.id === selectedId }}
            onPress={() => setSelectedId((current) => (current === point.id ? null : point.id))}
            onHoverIn={() => setSelectedId(point.id)}
            style={[styles.hit, { left: point.x - HIT_SIZE / 2, top: point.y - HIT_SIZE / 2 }]}
          />
        ))}
      </View>
      {seriesLabel || referenceLabel ? (
        <View style={styles.legend}>
          {seriesLabel ? <LegendItem color={colors.text} label={seriesLabel} /> : null}
          {referenceLabel ? <LegendItem color={colors.textSecondary} label={referenceLabel} dashed /> : null}
        </View>
      ) : null}
      <View accessibilityLiveRegion="polite" style={styles.details}>
        {selected ? (
          <>
            <Text variant="label" tabular>
              {t('progress.chart.tooltip', { date: pointDate(selected.at), value: formatValue(selected.value) })}
            </Text>
            {detailLabels.get(selected.id) ? (
              <Text variant="caption" tone="secondary">
                {detailLabels.get(selected.id)}
              </Text>
            ) : null}
          </>
        ) : (
          <Text variant="caption" tone="secondary">
            {t('progress.chart.hint')}
          </Text>
        )}
      </View>
    </View>
  );
}

function AxisLabel({ style, children }: { style: TextStyle; children: string }) {
  return (
    <Text variant="caption" tone="secondary" tabular numberOfLines={1} style={[styles.axisLabel, style]}>
      {children}
    </Text>
  );
}

function LegendItem({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }]} />
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  axisLabel: { position: 'absolute', fontSize: 11, lineHeight: 14 },
  hit: { position: 'absolute', width: HIT_SIZE, height: HIT_SIZE },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: { width: 18, height: 0, borderTopWidth: 2 },
  details: { minHeight: 40, gap: spacing.xs / 2, justifyContent: 'center' },
});
