import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/constants/theme';
import type { Verification } from '@/domain/program';
import { useT } from '@/i18n';

import { useTheme } from '../theme-provider';
import { Text, type TextTone } from '../ui';

const TONE: Record<Verification, TextTone> = {
  verified: 'secondary',
  partial: 'primary',
  unverified: 'danger',
};

/** The verification status of a program as a pill; the accessible name spells out what it is. */
export function VerificationBadge({ verification }: { verification: Verification }) {
  const t = useT();
  const { colors } = useTheme();
  const status =
    verification === 'verified'
      ? t('programs.verification.verified')
      : verification === 'partial'
        ? t('programs.verification.partial')
        : t('programs.verification.unverified');
  return (
    <View
      accessible
      accessibilityLabel={t('programs.verification.label', { status })}
      style={[styles.pill, { borderColor: colors.border, backgroundColor: colors.surfaceRaised }]}>
      <Text variant="caption" tone={TONE[verification]}>
        {status}
      </Text>
    </View>
  );
}

/** One sentence that says what the verification status means. */
export function useVerificationHint(): (verification: Verification) => string {
  const t = useT();
  return (verification) =>
    verification === 'verified'
      ? t('programs.verification.verifiedHint')
      : verification === 'partial'
        ? t('programs.verification.partialHint')
        : t('programs.verification.unverifiedHint');
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
