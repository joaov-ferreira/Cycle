import { useAppStore } from '@/state/app-store-context';
import { selectTrainingQueue } from '@/state/performance-selectors';
import { snapshotSessionId } from '@/domain/performance';
import { useI18n } from '@/i18n';

import { Button, Card, Screen, Text } from '../ui';

export type TrainingScreenProps = {
  /** Opens a session of an activated periodization (`p<periodizationId>-<key>`) for logging. */
  onOpenSession: (sessionId: string) => void;
};

type Line = { number: number; week: number; lift: 'bench' | 'squat' | 'deadlift'; program: string };

function SessionLine({ session }: { session: Line }) {
  const t = useI18n().t;
  return (
    <Text variant="label">
      {t('training.sessionLine', {
        number: session.number,
        week: session.week,
        lift: t(`lifts.${session.lift}`),
        program: session.program,
      })}
    </Text>
  );
}

/**
 * Training tab (SPEC §7, §11): the sessions in progress (drafts) and the next pending session of
 * the activated periodization, each opening the logging screen.
 */
export function TrainingScreen({ onOpenSession }: TrainingScreenProps) {
  const t = useI18n().t;
  const active = useAppStore((s) => s.activePeriodization);
  const { inProgress, next } = useAppStore(selectTrainingQueue);
  return (
    <Screen title={t('screens.training.title')} testID="screen-training">
      <Text tone="secondary">{t('training.intro')}</Text>
      {!active ? <Text tone="secondary">{t('training.noPeriodization')}</Text> : null}
      {active || inProgress.length > 0 ? (
        <>
          <Text variant="heading">{t('training.inProgress')}</Text>
          {inProgress.length === 0 ? <Text tone="secondary">{t('training.noneInProgress')}</Text> : null}
          {inProgress.map((record) => (
            <Card key={record.id} testID={`training-in-progress-${record.sessionKey}`}>
              <SessionLine
                session={{
                  number: record.sessionNumber,
                  week: record.blockWeek,
                  lift: record.lift,
                  program: record.templateName,
                }}
              />
              <Text tone="secondary">{t('training.setsLogged', { count: record.sets.length })}</Text>
              <Button
                label={t('training.resume')}
                accessibilityLabel={t('training.resumeFor', { number: record.sessionNumber, week: record.blockWeek })}
                onPress={() => onOpenSession(snapshotSessionId(record.periodizationId, record.sessionKey))}
              />
            </Card>
          ))}
        </>
      ) : null}
      {active ? (
        next ? (
          <>
            <Text variant="heading">{t('training.next')}</Text>
            <Card testID="training-next">
              <SessionLine
                session={{
                  number: next.session.sessionNumber,
                  week: next.session.blockWeek,
                  lift: next.session.lift,
                  program: next.session.templateName,
                }}
              />
              <Button
                label={t('training.start')}
                accessibilityLabel={t('training.startFor', {
                  number: next.session.sessionNumber,
                  week: next.session.blockWeek,
                })}
                onPress={() => onOpenSession(snapshotSessionId(next.periodizationId, next.session.key))}
              />
            </Card>
          </>
        ) : (
          <Text tone="secondary">{t('training.allStarted')}</Text>
        )
      ) : null}
    </Screen>
  );
}
