import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { useI18n } from '@/i18n';

import { Stepper } from '../../shared';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';

export type OptionalStepperProps = {
  /** Visible name of the quantity. */
  caption: string;
  /** Accessible name that identifies the exercise too; used by the buttons. */
  label: string;
  /** `undefined` = not set ("None"). */
  value: number | undefined;
  min: number;
  max: number;
  step?: number;
  /** The value given when the user turns the quantity on. */
  initial: number;
  onChange: (value: number | undefined) => void;
  format?: (value: number) => string;
  error?: string | null;
};

/** A `Stepper` that can also be "None": a Set button turns it on, Remove turns it off. */
export function OptionalStepper({
  caption,
  label,
  value,
  min,
  max,
  step,
  initial,
  onChange,
  format,
  error,
}: OptionalStepperProps) {
  const { t } = useI18n();
  return (
    <View style={styles.container}>
      <Text variant="label">{caption}</Text>
      <View style={styles.row}>
        {value === undefined ? (
          <>
            <Text tone="secondary" accessibilityLabel={label} style={styles.none}>
              {t('common.none')}
            </Text>
            <Button
              variant="secondary"
              label={t('planEditor.setOptional')}
              accessibilityLabel={t('planEditor.setOptionalOf', { label })}
              onPress={() => onChange(initial)}
            />
          </>
        ) : (
          <>
            <Stepper
              value={value}
              onChange={onChange}
              min={min}
              max={max}
              step={step}
              label={label}
              format={format}
            />
            <Button
              variant="secondary"
              label={t('common.remove')}
              accessibilityLabel={t('planEditor.clearOptionalOf', { label })}
              onPress={() => onChange(undefined)}
            />
          </>
        )}
      </View>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  none: { minWidth: spacing.xxl * 2, textAlign: 'center' },
});
