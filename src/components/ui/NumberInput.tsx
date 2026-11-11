import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { layout, radius, spacing, tabularNumbers, typography } from '@/constants/theme';
import {
  validateDecimal,
  type NumberRules,
  type NumberValidationError,
} from '@/domain/number-validation';
import {
  formatDecimalInput,
  normalizeDecimalInput,
  useI18n,
  type AppLocale,
  type TFunction,
} from '@/i18n';

import { useTheme } from '../theme-provider';
import { Text } from './Text';

export type NumberInputChange = { value: number | null; error: NumberValidationError | null };

export type NumberInputProps = {
  /** Visible label, also the accessible name of the field (localized). */
  label: string;
  /** Unit shown after the field, e.g. `kg`. */
  unit?: string;
  /** Initial value. The field keeps its own text while the user types. */
  value: number | null;
  rules: NumberRules;
  onChange: (change: NumberInputChange) => void;
  /**
   * Field only: the visible label, the unit and the inline error text are not rendered (the
   * accessible name stays, and an error still turns the border to the danger color).
   */
  compact?: boolean;
  testID?: string;
};

/**
 * What the text stands for, as reported to `onChange`: the parsed and validated value, or `null`
 * when the text is empty, invalid or out of the rules.
 */
function representText(text: string, locale: AppLocale, rules: NumberRules): NumberInputChange {
  const canonical = text.trim() === '' ? '' : normalizeDecimalInput(text, locale);
  const result = validateDecimal(canonical, rules);
  return result.ok
    ? { value: result.value, error: null }
    : { value: null, error: result.error };
}

function errorMessage(t: TFunction, error: NumberValidationError, rules: NumberRules): string {
  switch (error) {
    case 'belowMin':
      return t('validation.belowMin', { min: rules.min ?? 0 });
    case 'notAboveMin':
      return t('validation.notAboveMin', { min: rules.min ?? 0 });
    case 'aboveMax':
      return t('validation.aboveMax', { max: rules.max ?? 0 });
    case 'tooManyDecimals':
      return t('validation.tooManyDecimals', { count: rules.maxDecimals ?? 0 });
    case 'notMultipleOfStep':
      return t('validation.notMultipleOfStep', { step: rules.step ?? 0 });
    default:
      return t(`validation.${error}`);
  }
}

/**
 * Decimal input that accepts the locale's decimal separator (and `.` in pt-BR), validates
 * with domain rules and shows localized messages once the user has edited it.
 */
export function NumberInput({
  label,
  unit,
  value,
  rules,
  onChange,
  compact = false,
  testID,
}: NumberInputProps) {
  const { colors } = useTheme();
  const { locale, t } = useI18n();
  const [text, setText] = useState(() => formatDecimalInput(value, locale));
  const [error, setError] = useState<NumberValidationError | null>(null);
  const textRef = useRef(text);
  const lastValueRef = useRef(value);

  function handleChange(next: string) {
    textRef.current = next;
    setText(next);
    const change = representText(next, locale, rules);
    setError(change.error);
    onChange(change);
  }

  // Follows a value the parent changed on its own. The parent echoing back what the user just
  // typed (or a value the text already stands for) is not a change: partial input such as `42,`
  // stays as typed.
  useEffect(() => {
    if (lastValueRef.current === value) return;
    lastValueRef.current = value;
    if (representText(textRef.current, locale, rules).value === value) return;
    const formatted = formatDecimalInput(value, locale);
    textRef.current = formatted;
    setText(formatted);
    setError(null);
  }, [value, locale, rules]);

  return (
    <View style={styles.container}>
      {compact ? null : <Text variant="label">{label}</Text>}
      <View style={styles.row}>
        <TextInput
          accessibilityLabel={label}
          value={text}
          onChangeText={handleChange}
          keyboardType="decimal-pad"
          inputMode="decimal"
          testID={testID}
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.input,
            tabularNumbers,
            {
              color: colors.text,
              backgroundColor: colors.surface,
              borderColor: error ? colors.danger : colors.border,
            },
          ]}
        />
        {unit && !compact ? <Text tone="secondary">{unit}</Text> : null}
      </View>
      {error && !compact ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {errorMessage(t, error, rules)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    ...typography.body,
    flex: 1,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
});
