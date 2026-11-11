import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { useI18n } from '@/i18n';

import { Text } from '../ui/Text';
import { SET_ROW_LAYOUT } from './set-row';

/**
 * Column captions for the sets of one exercise: one line aligned with the columns of `SetRow`.
 * Rendered once per exercise, above its rows.
 */
export function SetRowHeader({ testID }: { testID?: string }) {
  const { t } = useI18n();
  return (
    <View testID={testID} style={styles.line}>
      <View style={styles.set}>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {t('common.set')}
        </Text>
      </View>
      <View style={styles.weight}>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {t('common.kg')}
        </Text>
      </View>
      <View style={styles.reps}>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {t('common.reps')}
        </Text>
      </View>
      <View style={styles.rir}>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {t('common.rir')}
        </Text>
      </View>
      <View style={styles.done} />
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: SET_ROW_LAYOUT.gap },
  set: { width: SET_ROW_LAYOUT.control, alignItems: 'center' },
  weight: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: SET_ROW_LAYOUT.weightMinWidth,
    paddingHorizontal: spacing.xs,
  },
  reps: { width: SET_ROW_LAYOUT.reps, alignItems: 'center' },
  rir: { width: SET_ROW_LAYOUT.rir, alignItems: 'center' },
  done: { width: SET_ROW_LAYOUT.control },
});
