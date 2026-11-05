import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/constants/theme';
import { useT } from '@/i18n';
import type { Verification } from '@/programs/schema';

import { useTheme } from '../theme-provider';
import { Text } from '../ui';

/** Verification status of a template, as a text badge (never by color alone). */
export function VerificationBadge({ status }: { status: Verification }) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <View style={[styles.badge, { borderColor: status === 'verified' ? colors.border : colors.danger }]}>
      <Text variant="caption" tone={status === 'verified' ? 'secondary' : 'danger'}>
        {t(`programs.verification.${status}`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
