import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';
import { useT } from '@/i18n';

import { useTheme } from '../theme-provider';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  /** Defaults to the localized "Cancel". */
  cancelLabel?: string;
  /** Styles the confirm action as destructive (e.g. delete, discard). */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
};

/** Modal question with a confirm and a cancel action. Renders nothing while not visible. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
  testID = 'confirm-dialog',
}: ConfirmDialogProps) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View
          testID={testID}
          accessibilityViewIsModal
          style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="heading">{title}</Text>
          {message ? <Text tone="secondary">{message}</Text> : null}
          <View style={styles.actions}>
            <Button
              variant="secondary"
              label={cancelLabel ?? t('common.cancel')}
              onPress={onCancel}
            />
            {destructive ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={confirmLabel}
                onPress={onConfirm}
                style={({ pressed }) => [
                  styles.destructive,
                  { backgroundColor: colors.surfaceRaised },
                  pressed && styles.pressed,
                ]}>
                <Text variant="label" style={{ color: colors.danger }}>
                  {confirmLabel}
                </Text>
              </Pressable>
            ) : (
              <Button label={confirmLabel} onPress={onConfirm} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  panel: {
    width: '100%',
    maxWidth: layout.maxContentWidth / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  destructive: {
    minHeight: layout.minTouchTarget,
    minWidth: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
