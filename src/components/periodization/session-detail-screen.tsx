import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { LIFTS } from '@/domain/lifts';
import { findSession, type GeneratedSession, type SessionWarning, type Volume } from '@/domain/periodization';
import { parseSessionId, snapshotSessionId } from '@/domain/performance';
import { useI18n } from '@/i18n';
import { findTemplate } from '@/programs/registry';
import type { ProgramTemplate } from '@/programs/schema';
import type { StoredPeriodization } from '@/data/repositories';
import { useAppStore } from '@/state/app-store-context';
import { selectPeriodization } from '@/state/periodization-selectors';

import { PerformanceLogger } from '../performance/performance-logger';
import { SourceCard } from '../programs/source-card';
import { VerificationBadge } from '../programs/verification-badge';
import { Button, Card, Screen, Text } from '../ui';
import { SessionItems, useSessionContext } from './session-prescription';

const UTC_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' };

export type SessionDetailProps = {
  session: GeneratedSession;
  /** The session's program (for its source); the card is omitted when it is unknown. */
  template: ProgramTemplate | undefined;
};

function SessionWarnings({ warnings }: { warnings: readonly SessionWarning[] }) {
  const t = useI18n().t;
  if (warnings.length === 0) return null;
  return (
    <Card testID="session-warnings">
      <Text variant="heading">{t('periodization.warnings.title')}</Text>
      {warnings.map((warning, index) => (
        <Text key={index} tone="danger">
          {warning.code === 'missingOneRm'
            ? t('periodization.warnings.missingOneRm', { lift: t(`lifts.${warning.lift}`) })
            : warning.code === 'liftNotInDay'
              ? t('session.liftNotInDayWarning')
              : t('session.unverifiedWarning')}
        </Text>
      ))}
    </Card>
  );
}

/**
 * The detailed prescription of one generated session (SPEC §6-B): program, version and
 * source, every set with its exact → rounded load, accessories, volume and warnings.
 */
export function SessionDetail({ session, template }: SessionDetailProps) {
  const { t, formatKg } = useI18n();
  const sessionContext = useSessionContext();
  const volumeText = (volume: Volume) => ({ tonnage: formatKg(volume.tonnageKg), count: volume.totalReps });
  const liftVolumes = LIFTS.flatMap((lift) => {
    const volume = session.volumeByLift[lift];
    return volume ? [{ lift, volume }] : [];
  });
  return (
    <>
      <Card>
        <Text variant="heading">{t(`lifts.${session.lift}`)}</Text>
        <Text>{session.templateName}</Text>
        <VerificationBadge status={session.verification} />
        <Text tone="secondary">{t('programs.version', { version: session.templateVersion })}</Text>
        <Text tone="secondary">{sessionContext(session)}</Text>
      </Card>
      <Card>
        <Text variant="heading">{t('session.prescription')}</Text>
        <View style={styles.items}>
          <SessionItems session={session} />
        </View>
      </Card>
      <Card>
        <Text variant="heading">{t('session.volume')}</Text>
        <Text variant="label" tabular>
          {t('periodization.table.volume', volumeText(session.volume))}
        </Text>
        {liftVolumes.length > 1
          ? liftVolumes.map(({ lift, volume }) => (
              <Text key={lift} tabular tone="secondary">
                {t('periodization.table.liftTotal', { lift: t(`lifts.${lift}`), ...volumeText(volume) })}
              </Text>
            ))
          : null}
      </Card>
      <SessionWarnings warnings={session.warnings} />
      {template ? <SourceCard source={template.source} /> : null}
    </>
  );
}

export type SessionDetailScreenProps = {
  /**
   * Session key `<slotId>-w<blockWeek>` of the live periodization, or `p<periodizationId>-<key>`
   * for a session of an activated periodization (the one performance is logged against).
   */
  sessionId: string;
  onBack?: () => void;
  /** Opens a session by id; used to jump from a live session to its logging screen. */
  onOpenSession?: (sessionId: string) => void;
};

type Shell = { sessionId: string; onBack?: () => void };

function NotFound({ onBack }: { onBack?: () => void }) {
  const t = useI18n().t;
  return (
    <Screen title={t('session.title')} testID="screen-session">
      {onBack ? <Button variant="secondary" label={t('session.back')} onPress={onBack} /> : null}
      <Text tone="secondary">{t('session.notFound')}</Text>
    </Screen>
  );
}

/** Entry to performance logging from a live session: it goes to the activated snapshot. */
function LogEntry({ sessionKey, onOpenSession }: { sessionKey: string; onOpenSession?: (id: string) => void }) {
  const { t, formatDate } = useI18n();
  const active = useAppStore((s) => s.activePeriodization);
  const activeSessions = useAppStore((s) => s.activeSessions);
  if (!active) return <Text tone="secondary">{t('session.logNeedsActivation')}</Text>;
  if (!activeSessions.some((session) => session.key === sessionKey)) {
    return <Text tone="secondary">{t('session.logNotInActive')}</Text>;
  }
  return (
    <Card testID="session-log-entry">
      <Text variant="heading">{t('performance.title')}</Text>
      <Text tone="secondary">
        {t('session.logNote', { date: formatDate(new Date(`${active.startDate}T00:00:00Z`), UTC_DATE) })}
      </Text>
      {onOpenSession ? (
        <Button label={t('session.log')} onPress={() => onOpenSession(snapshotSessionId(active.id, sessionKey))} />
      ) : null}
    </Card>
  );
}

/**
 * Live session detail. The key refers to the live periodization (the same `selectPeriodization`
 * the table and calendar read); a key that matches no session, for example after the slot was
 * removed, shows a not-found message.
 */
function LiveSessionScreen({ sessionId, onBack, onOpenSession }: Shell & Pick<SessionDetailScreenProps, 'onOpenSession'>) {
  const t = useI18n().t;
  const periodization = useAppStore(selectPeriodization);
  const session = findSession(periodization, sessionId);
  if (!session) return <NotFound onBack={onBack} />;
  return (
    <Screen
      title={t('session.heading', { number: session.sessionNumber, week: session.blockWeek })}
      testID="screen-session">
      {onBack ? <Button variant="secondary" label={t('session.back')} onPress={onBack} /> : null}
      <SessionDetail session={session} template={findTemplate(session.templateId)} />
      <LogEntry sessionKey={session.key} onOpenSession={onOpenSession} />
    </Screen>
  );
}

type SnapshotSession = { periodization: StoredPeriodization; session: GeneratedSession };

/**
 * A session of an activated periodization: its frozen prescription plus the performance logger.
 * The snapshot is loaded from persistence, so it does not change when slots or 1RMs are edited.
 */
function SnapshotSessionScreen({
  periodizationId,
  sessionKey,
  onBack,
}: {
  periodizationId: number;
  sessionKey: string;
  onBack?: () => void;
}) {
  const { t, formatDate } = useI18n();
  const load = useAppStore((s) => s.loadSnapshotSession);
  const [loaded, setLoaded] = useState<SnapshotSession | null | 'loading'>('loading');
  useEffect(() => {
    let cancelled = false;
    void load(periodizationId, sessionKey).then((result) => {
      if (!cancelled) setLoaded(result);
    });
    return () => {
      cancelled = true;
    };
  }, [load, periodizationId, sessionKey]);

  if (loaded === null) return <NotFound onBack={onBack} />;
  const back = onBack ? <Button variant="secondary" label={t('session.back')} onPress={onBack} /> : null;
  if (loaded === 'loading') {
    return (
      <Screen title={t('session.title')} testID="screen-session">
        {back}
        <Text tone="secondary">{t('session.loading')}</Text>
      </Screen>
    );
  }
  const { periodization, session } = loaded;
  return (
    <Screen
      title={t('session.heading', { number: session.sessionNumber, week: session.blockWeek })}
      testID="screen-session">
      {back}
      <Text tone="secondary">
        {t('performance.activation', { date: formatDate(new Date(`${periodization.startDate}T00:00:00Z`), UTC_DATE) })}
      </Text>
      <PerformanceLogger periodizationId={periodization.id} session={session} />
      <SessionDetail session={session} template={findTemplate(session.templateId)} />
    </Screen>
  );
}

/** Session detail route screen (see `SessionDetailScreenProps.sessionId` for the id forms). */
export function SessionDetailScreen({ sessionId, onBack, onOpenSession }: SessionDetailScreenProps) {
  const { periodizationId, key } = parseSessionId(sessionId);
  return periodizationId === null ? (
    <LiveSessionScreen sessionId={key} onBack={onBack} onOpenSession={onOpenSession} />
  ) : (
    <SnapshotSessionScreen key={sessionId} periodizationId={periodizationId} sessionKey={key} onBack={onBack} />
  );
}

const styles = StyleSheet.create({
  items: { gap: spacing.md },
});
