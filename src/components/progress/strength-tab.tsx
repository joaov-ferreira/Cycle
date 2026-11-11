import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, spacing } from '@/constants/theme';
import { PERIODS, type Period } from '@/domain/period';
import type { StrengthCard, StrengthSeries } from '@/domain/strength';
import { useI18n } from '@/i18n';
import { selectStrengthCards, selectStrengthSeries, useAppStore, selectFindExercise } from '@/state';

import { EmptyState, useExerciseName } from '../shared';
import { Card, SegmentedControl, Text } from '../ui';
import { LineChart } from './line-chart';
import { useStrengthFormat } from './strength-format';

export type StrengthTabProps = {
  now: Date;
  /** Opens the reference 1RM screen of an exercise (`/maxes/<exerciseId>`). */
  onOpenMax?: (exerciseId: string) => void;
  /** Opens the 1RMs screen (`/maxes`). */
  onOpenMaxes?: () => void;
};

/** Progress → Strength (SPEC-v4 §8): a card per exercise with a reference 1RM, over a period. */
export function StrengthTab({ now, onOpenMax, onOpenMaxes }: StrengthTabProps) {
  const { t } = useI18n();
  const [period, setPeriod] = useState<Period>('all');
  const cards = useAppStore((state) => selectStrengthCards(state, period, now));

  return (
    <>
      <SegmentedControl
        label={t('progress.periodGroup')}
        options={PERIODS.map((value) => ({ value, label: t(`progress.periods.${value}`) }))}
        value={period}
        onChange={setPeriod}
      />
      {cards.length === 0 ? (
        <EmptyState
          title={t('strength.empty.title')}
          message={t('strength.empty.message')}
          actionLabel={t('strength.empty.action')}
          onAction={onOpenMaxes}
          testID="strength-empty"
        />
      ) : (
        cards.map(({ exerciseId, card }) => (
          <StrengthCardView
            key={exerciseId}
            exerciseId={exerciseId}
            card={card}
            period={period}
            now={now}
            onOpen={onOpenMax}
          />
        ))
      )}
    </>
  );
}

function StrengthCardView({
  exerciseId,
  card,
  period,
  now,
  onOpen,
}: {
  exerciseId: string;
  card: StrengthCard;
  period: Period;
  now: Date;
  onOpen?: (exerciseId: string) => void;
}) {
  const { t, formatDate } = useI18n();
  const format = useStrengthFormat();
  const nameOf = useExerciseName();
  const findExercise = useAppStore(selectFindExercise);
  const series = useAppStore((state) => selectStrengthSeries(state, exerciseId, period, now));

  const exercise = findExercise(exerciseId);
  const name = exercise ? nameOf(exercise) : exerciseId;
  const date = (iso: string) => formatDate(new Date(iso));
  const periodName = t(`progress.periodNames.${period}`);
  const estimate = (value: { kg: number; date: string }) =>
    t('strength.card.estimate', { kg: format.kg(value.kg), date: date(value.date) });

  return (
    <Card testID={`strength-card-${exerciseId}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('strength.card.open', { name })}
        onPress={() => onOpen?.(exerciseId)}
        style={styles.header}>
        <Text variant="heading">{name}</Text>
        {card.reference ? (
          <Text tone="secondary" tabular>
            {t('strength.card.reference', {
              kg: format.kg(card.reference.kg, 2),
              date: date(card.reference.effectiveAt),
              origin: format.originOfMax(card.reference.origin),
            })}
          </Text>
        ) : null}
      </Pressable>

      {card.latest ? (
        <>
          <Stat label={t('strength.card.latest')} value={estimate(card.latest)} />
          {card.previous ? <Stat label={t('strength.card.previous')} value={estimate(card.previous)} /> : null}
          {card.best ? <Stat label={t('strength.card.best')} value={estimate(card.best)} /> : null}
          {card.delta ? (
            <Text tabular>
              {t('strength.card.delta', {
                kg: format.signedKg(card.delta.kg),
                percent: format.signedPercent(card.delta.percent),
              })}
            </Text>
          ) : null}
          {card.improvement ? (
            <Text tabular>
              {t('strength.card.improvement', {
                period: periodName,
                kg: format.signedKg(card.improvement.kg),
                percent: format.signedPercent(card.improvement.percent),
                baseline: format.kg(card.improvement.baselineKg, 2),
              })}
            </Text>
          ) : null}
          <StrengthChart label={name} series={series} period={period} now={now} />
        </>
      ) : (
        <Text tone="secondary">{t('strength.card.noEstimate', { period: periodName })}</Text>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text tone="secondary">{label}</Text>
      <Text tabular>{value}</Text>
    </View>
  );
}

/** Estimates as points, reference records as a step line. */
function StrengthChart({
  label,
  series,
  period,
  now,
}: {
  label: string;
  series: StrengthSeries;
  period: Period;
  now: Date;
}) {
  const { t } = useI18n();
  const format = useStrengthFormat();
  const points = useMemo(
    () => series.points.map((point) => ({ id: point.workoutId, at: point.date, value: point.kg })),
    [series.points],
  );
  const references = useMemo(() => series.steps.map((step) => ({ at: step.date, value: step.kg })), [series.steps]);
  return (
    <LineChart
      label={label}
      seriesLabel={t('strength.chart.estimates')}
      referenceLabel={t('strength.chart.references')}
      series={points}
      references={references}
      period={period}
      now={now}
      height={180}
      formatValue={(value) => format.kg(value)}
    />
  );
}

const styles = StyleSheet.create({
  header: { minHeight: layout.minTouchTarget, justifyContent: 'center', gap: spacing.xs },
  stat: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
});
