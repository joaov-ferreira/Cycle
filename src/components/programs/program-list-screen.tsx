import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';
import type { ProgramFamily } from '@/domain/program';
import { useI18n } from '@/i18n';
import { programsByFamily } from '@/library';

import { useTheme } from '../theme-provider';
import { Button, Screen, Text } from '../ui';
import { VerificationBadge } from './verification-badge';

export type ProgramListScreenProps = {
  onOpenProgram: (programId: string) => void;
  onBack?: () => void;
};

/** Programs → list (SPEC-v4 §10.2): the program library grouped by family. */
export function ProgramListScreen({ onOpenProgram, onBack }: ProgramListScreenProps) {
  const { t } = useI18n();
  const { colors } = useTheme();

  const familyName = (family: ProgramFamily): string =>
    family === '531-custom'
      ? t('programs.families.531-custom')
      : family === 'smolov-jr'
        ? t('programs.families.smolov-jr')
        : family === 'smolov'
          ? t('programs.families.smolov')
          : t('programs.families.sheiko');

  return (
    <Screen title={t('programs.list.title')} testID="screen-program-list">
      {onBack ? <Button variant="secondary" label={t('common.back')} onPress={onBack} /> : null}
      <Text tone="secondary">{t('programs.list.intro')}</Text>
      {programsByFamily().map((group) => (
        <View key={group.family} style={styles.group}>
          <Text variant="heading">{familyName(group.family)}</Text>
          {group.programs.map((program) => {
            const title = program.name;
            return (
              <Pressable
                key={program.id}
                accessibilityRole="button"
                accessibilityLabel={t('programs.list.open', { name: title })}
                onPress={() => onOpenProgram(program.id)}
                testID={`program-${program.id}`}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}>
                <Text variant="label">{title}</Text>
                <Text tone="secondary">
                  {t('programs.list.summary', {
                    weeks: t('programs.list.weeks', { count: program.durationWeeks }),
                    days: t('programs.list.days', { count: program.daysPerWeek }),
                  })}
                </Text>
                <VerificationBadge verification={program.verification} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  card: {
    minHeight: layout.minTouchTarget,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.6 },
});
