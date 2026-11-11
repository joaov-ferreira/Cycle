import { Pressable, StyleSheet, View } from 'react-native';

import { layout, spacing } from '@/constants/theme';
import { MUSCLE_GROUPS } from '@/domain/exercise';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';
import { selectFindExercise } from '@/state/selectors';
import { selectCycleReport } from '@/state/selectors-v3';

import { EmptyState, exerciseName, muscleLabelKey } from '../shared';
import { Button, Card, Screen, Text } from '../ui';

export type CycleReportScreenProps = {
  planId: number;
  cycleNumber: number;
  onBack: () => void;
  onReviewWithAi: (planId: number) => void;
  onOpenExercise?: (exerciseId: string) => void;
};

/** Cycle report (SPEC-v3 §6): adherence, volume, a row per exercise and weekly sets per muscle. */
export function CycleReportScreen({
  planId,
  cycleNumber,
  onBack,
  onReviewWithAi,
  onOpenExercise,
}: CycleReportScreenProps) {
  const { t, locale, formatNumber, formatKg, formatDate } = useI18n();
  const plan = useAppStore((s) => s.plans.find((candidate) => candidate.id === planId));
  const report = useAppStore((s) => selectCycleReport(s, planId, cycleNumber));
  const findExercise = useAppStore(selectFindExercise);

  const back = <Button variant="secondary" label={t('cycleReport.back')} onPress={onBack} />;

  if (!plan || !report) {
    return (
      <Screen title={t('cycleReport.title', { cycle: cycleNumber })} testID="screen-cycle-report">
        {back}
        <EmptyState
          title={t('cycleReport.notFoundTitle')}
          message={t('cycleReport.notFoundMessage')}
          testID="cycle-report-not-found"
        />
      </Screen>
    );
  }

  const kg = (value: number) => formatKg(value, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const percent = (value: number, digits: number) =>
    t('cycleReport.percent', {
      value: formatNumber(value, { minimumFractionDigits: digits, maximumFractionDigits: digits }),
    });
  const loadText = (first: number | null, last: number | null) => {
    if (first === null || last === null) return t('cycleReport.noLoad');
    return first === last ? kg(first) : t('cycleReport.loadRange', { from: kg(first), to: kg(last) });
  };
  const changeText = (change: number) =>
    `${change > 0 ? '+' : change < 0 ? '-' : ''}${percent(Math.abs(change), 1)}`;

  const muscles = MUSCLE_GROUPS.filter((muscle) => report.muscleSetsPerWeek[muscle] !== undefined);
  const empty = report.sessions.done === 0;

  return (
    <Screen title={t('cycleReport.title', { cycle: cycleNumber })} testID="screen-cycle-report">
      {back}
      <Text variant="heading">{plan.name}</Text>
      {empty ? (
        <EmptyState
          title={t('cycleReport.emptyTitle')}
          message={t('cycleReport.emptyMessage')}
          testID="cycle-report-empty"
        />
      ) : (
        <>
          <Card testID="cycle-report-summary">
            {report.startedAt && report.endedAt ? (
              <Text tone="secondary">
                {t('cycleReport.period', {
                  from: formatDate(new Date(report.startedAt)),
                  to: formatDate(new Date(report.endedAt)),
                })}
              </Text>
            ) : null}
            <View style={styles.stat}>
              <Text tone="secondary">{t('cycleReport.sessionsLabel')}</Text>
              <Text tabular>
                {t('cycleReport.sessions', {
                  done: formatNumber(report.sessions.done),
                  planned: formatNumber(report.sessions.planned),
                })}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text tone="secondary">{t('cycleReport.adherenceLabel')}</Text>
              <Text tabular>{percent(Math.round(report.adherence * 100), 0)}</Text>
            </View>
            <View style={styles.stat}>
              <Text tone="secondary">{t('cycleReport.volumeLabel')}</Text>
              <Text tabular>{formatKg(report.volumeKg, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</Text>
            </View>
          </Card>

          <View style={styles.section}>
            <Text variant="heading">{t('cycleReport.exercisesTitle')}</Text>
            {report.exercises.map((row) => {
              const found = findExercise(row.exerciseId);
              const name = found ? exerciseName(found, locale) : row.exerciseId;
              return (
                <Card key={row.exerciseId} testID={`report-exercise-${row.exerciseId}`}>
                  {onOpenExercise ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('cycleReport.openExercise', { name })}
                      onPress={() => onOpenExercise(row.exerciseId)}
                      style={styles.nameButton}>
                      <Text variant="label">{name}</Text>
                    </Pressable>
                  ) : (
                    <Text variant="label">{name}</Text>
                  )}
                  <View style={styles.facts}>
                    <Text tone="secondary">{t('cycleReport.exerciseSessions', { count: row.sessions })}</Text>
                    <Text tabular>{loadText(row.firstLoadKg, row.lastLoadKg)}</Text>
                    {row.scoreChangePct !== null ? <Text tabular>{changeText(row.scoreChangePct)}</Text> : null}
                    {row.stalled ? (
                      <Text tone="danger">{t('cycleReport.stalled')}</Text>
                    ) : null}
                    {row.records > 0 ? (
                      <Text tone="accent">{t('cycleReport.records', { count: row.records })}</Text>
                    ) : null}
                  </View>
                </Card>
              );
            })}
          </View>

          {muscles.length > 0 ? (
            <Card testID="cycle-report-muscles">
              <Text variant="heading">{t('cycleReport.musclesTitle')}</Text>
              {muscles.map((muscle) => (
                <Text key={muscle} tabular>
                  {t('cycleReport.muscleSets', {
                    muscle: t(muscleLabelKey(muscle)),
                    sets: formatNumber(report.muscleSetsPerWeek[muscle] ?? 0, {
                      maximumFractionDigits: 1,
                    }),
                  })}
                </Text>
              ))}
            </Card>
          ) : null}
        </>
      )}
      <Button label={t('cycleReport.reviewWithAi')} onPress={() => onReviewWithAi(planId)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  stat: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.xs },
  nameButton: { minHeight: layout.minTouchTarget, justifyContent: 'center' },
});
