import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/constants/theme';

import { useTheme } from '../theme-provider';
import { Text, type TextTone } from '../ui/Text';

export type TagProps = {
  label: string;
  /** `accent` (default), `danger` for data that needs care, `neutral` for plain information. */
  tone?: 'accent' | 'danger' | 'neutral';
  testID?: string;
};

const TEXT_TONE: Record<NonNullable<TagProps['tone']>, TextTone> = {
  accent: 'accent',
  danger: 'danger',
  neutral: 'secondary',
};

/** A small outlined label such as "AMRAP" or "Unverified data". */
export function Tag({ label, tone = 'accent', testID }: TagProps) {
  const { colors } = useTheme();
  const border = tone === 'accent' ? colors.accent : tone === 'danger' ? colors.danger : colors.border;
  return (
    <View testID={testID} style={[styles.tag, { borderColor: border }]}>
      <Text variant="caption" tone={TEXT_TONE[tone]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
});
