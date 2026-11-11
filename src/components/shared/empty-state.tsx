import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';

import { Button } from '../ui/Button';
import { Text } from '../ui/Text';

export type EmptyStateProps = {
  title: string;
  message?: string;
  /** Localized label of the optional action button. */
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
};

/** Centered placeholder for a list or screen with nothing to show, with an optional action. */
export function EmptyState({ title, message, actionLabel, onAction, testID }: EmptyStateProps) {
  return (
    <View testID={testID} style={styles.container}>
      <Text variant="heading" style={styles.center}>
        {title}
      </Text>
      {message ? (
        <Text tone="secondary" style={styles.center}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  center: { textAlign: 'center' },
});
