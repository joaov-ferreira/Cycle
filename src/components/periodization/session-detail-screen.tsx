import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { LIFTS } from '@/domain/lifts';
import { findSession, type GeneratedSession, type SessionWarning, type Volume } from '@/domain/periodization';
import { useI18n } from '@/i18n';
import { findTemplate } from '@/programs/registry';
import type { ProgramTemplate } from '@/programs/schema';
import { useAppStore } from '@/state/app-store-context';
import { selectPeriodization } from '@/state/periodization-selectors';

import { SourceCard } from '../programs/source-card';
import { VerificationBadge } from '../programs/verification-badge';
import { Button, Card, Screen, Text } from '../ui';
import { SessionItems, useSessionContext } from './session-prescription';

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
  /** Session key `<slotId>-w<blockWeek>` from the live periodization. */
  sessionId: string;
  onBack?: () => void;
};

/**
 * Session detail route screen. The id refers to the live periodization (the same
 * `selectPeriodization` the table and calendar read); an id that matches no session, for
 * example after the slot was removed, shows a not-found message.
 */
export function SessionDetailScreen({ sessionId, onBack }: SessionDetailScreenProps) {
  const t = useI18n().t;
  const periodization = useAppStore(selectPeriodization);
  const session = findSession(periodization, sessionId);
  const back = onBack ? <Button variant="secondary" label={t('session.back')} onPress={onBack} /> : null;
  if (!session) {
    return (
      <Screen title={t('session.title')} testID="screen-session">
        {back}
        <Text tone="secondary">{t('session.notFound')}</Text>
      </Screen>
    );
  }
  return (
    <Screen
      title={t('session.heading', { number: session.sessionNumber, week: session.blockWeek })}
      testID="screen-session">
      {back}
      <SessionDetail session={session} template={findTemplate(session.templateId)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  items: { gap: spacing.md },
});
