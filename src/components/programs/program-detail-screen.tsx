import { Linking, StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import type { ConfigurableParam } from '@/domain/program';
import { useI18n } from '@/i18n';
import { findProgram } from '@/library';
import { useAppStore } from '@/state/app-store-context';
import { selectFindExercise } from '@/state/selectors';

import { EmptyState, exerciseName } from '../shared';
import { Button, Card, Screen, Text } from '../ui';
import { WeekSection } from './program-weeks';
import { useProgramText } from './set-label';
import { VerificationBadge, useVerificationHint } from './verification-badge';

export type ProgramDetailScreenProps = {
  programId: string;
  onBack: () => void;
  onStart: (programId: string) => void;
  /** Opens a URL; defaults to the system browser. */
  openUrl?: (url: string) => void;
};

function openExternalUrl(url: string): void {
  void Linking.openURL(url).catch(() => undefined);
}

/** `YYYY-MM-DD` as a local calendar date (no time-zone shift). */
function localDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Programs → detail (SPEC-v4 §10.2): source, roles, parameters and the whole program, no loads. */
export function ProgramDetailScreen({ programId, onBack, onStart, openUrl = openExternalUrl }: ProgramDetailScreenProps) {
  const { t, locale, formatDate, formatKg, formatPercent } = useI18n();
  const text = useProgramText();
  const verificationHint = useVerificationHint();
  const findExercise = useAppStore(selectFindExercise);
  const program = findProgram(programId);

  if (!program) {
    return (
      <Screen testID="screen-program-detail">
        <Button variant="secondary" label={t('common.back')} onPress={onBack} />
        <EmptyState title={t('programs.detail.notFoundTitle')} message={t('programs.detail.notFoundMessage')} />
      </Screen>
    );
  }

  const value = (param: ConfigurableParam, amount: number): string =>
    param.unit === 'kg' ? formatKg(amount) : formatPercent(amount);
  const { source } = program;

  return (
    <Screen title={program.name} testID="screen-program-detail">
      <Button variant="secondary" label={t('common.back')} onPress={onBack} />
      <Text tone="secondary">
        {t('programs.list.summary', {
          weeks: t('programs.list.weeks', { count: program.durationWeeks }),
          days: t('programs.list.days', { count: program.daysPerWeek }),
        })}
      </Text>
      <View style={styles.badges}>
        <VerificationBadge verification={program.verification} />
        <Text tone="secondary">{verificationHint(program.verification)}</Text>
      </View>
      <Button label={t('programs.detail.start')} onPress={() => onStart(program.id)} />

      <Card>
        <Text variant="heading">{t('programs.detail.sourceTitle')}</Text>
        <Text>{t('programs.detail.author', { author: source.author })}</Text>
        <Text>{t('programs.detail.reference', { reference: source.reference })}</Text>
        {source.url ? (
          <Button
            variant="secondary"
            label={t('programs.detail.link')}
            hint={source.url}
            onPress={() => openUrl(source.url as string)}
          />
        ) : null}
        <Text tone="secondary">
          {t('programs.detail.accessed', { date: formatDate(localDate(source.accessedAt)) })}
        </Text>
        {source.notes ? (
          <Text tone="secondary">{t('programs.detail.notes', { notes: source.notes })}</Text>
        ) : null}
        <Text tone="secondary">{t('programs.detail.version', { version: program.version })}</Text>
      </Card>

      <Card>
        <Text variant="heading">{t('programs.detail.rolesTitle')}</Text>
        {program.roles.map((role) => {
          const exercise = role.defaultExerciseId ? findExercise(role.defaultExerciseId) : undefined;
          return (
            <View key={role.id} style={styles.entry} testID={`role-${role.id}`}>
              <Text variant="label">{text(role.label)}</Text>
              <Text tone="secondary">
                {exercise
                  ? t('programs.detail.roleDefault', { name: exerciseName(exercise, locale) })
                  : t('programs.detail.roleNoDefault')}
              </Text>
              {role.fixedInOriginal ? (
                <Text variant="caption" tone="accent">
                  {t('programs.detail.roleFixed')}
                </Text>
              ) : null}
            </View>
          );
        })}
      </Card>

      {program.configurable && program.configurable.length > 0 ? (
        <Card>
          <Text variant="heading">{t('programs.detail.paramsTitle')}</Text>
          {program.configurable.map((param) => (
            <View key={param.id} style={styles.entry}>
              <Text variant="label">{text(param.label)}</Text>
              <Text tone="secondary">
                {t('programs.detail.paramRange', {
                  min: value(param, param.min),
                  max: value(param, param.max),
                  default: value(param, param.default),
                })}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      <View style={styles.weeks}>
        <Text variant="heading">{t('programs.detail.weeksTitle')}</Text>
        <Text tone="secondary">{t('programs.detail.weeksNote')}</Text>
        {program.weeks.map((week, index) => (
          <WeekSection key={week.week} template={program} week={week} initiallyOpen={index === 0} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  badges: { gap: spacing.sm },
  entry: { gap: spacing.xs },
  weeks: { gap: spacing.sm },
});
