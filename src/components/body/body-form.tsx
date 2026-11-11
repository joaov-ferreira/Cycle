import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import {
  BODY_METRIC_LIMITS,
  BODY_METRIC_UNITS,
  type BodyMetric,
  type BodyMetricErrors,
  type BodyMetricKind,
} from '@/domain/body';
import type { NumberRules } from '@/domain/number-validation';
import { useI18n, type MessageKey } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';
import { BodyMetricValidationError } from '@/state/errors';

import { Button, Card, NumberInput, Text, TextField } from '../ui';

/** Errors shown under the fields: store codes, plus `save` for a failure that is not validation. */
type FormErrors = {
  date?: keyof typeof DATE_MESSAGES;
  value?: keyof typeof VALUE_MESSAGES;
  save?: boolean;
};

const DATE_MESSAGES = {
  required: 'body.errors.date.required',
  invalidDate: 'body.errors.date.invalidDate',
  inFuture: 'body.errors.date.inFuture',
} as const satisfies Record<string, MessageKey>;

const VALUE_MESSAGES = {
  required: 'body.errors.value.required',
  outOfRange: 'body.errors.value.outOfRange',
  tooManyDecimals: 'body.errors.value.tooManyDecimals',
} as const satisfies Record<string, MessageKey>;

/** The number field only reports what it cannot read; ranges and decimals come from the store. */
const NO_RULES: NumberRules = {};

export type BodyFormProps = {
  kind: BodyMetricKind;
  /** Today's local date, `YYYY-MM-DD`: the default date of a new entry. */
  today: string;
  /** The entry loaded for editing, or `null` for a new one. */
  editing: BodyMetric | null;
  onSaved: () => void;
  onCancelEdit: () => void;
};

/**
 * Add or edit one measurement (SPEC-v3 §9). Saving goes through the store, which validates and
 * replaces the value of the same day and kind; its errors are shown next to their fields.
 */
export function BodyForm({ kind, today, editing, onSaved, onCancelEdit }: BodyFormProps) {
  const { t } = useI18n();
  const saveBodyMetric = useAppStore((s) => s.saveBodyMetric);
  const [date, setDate] = useState(editing?.date ?? today);
  const [value, setValue] = useState<number | null>(editing?.value ?? null);
  const [numberInvalid, setNumberInvalid] = useState(false);
  // Changing the key remounts the number field, which clears what the user typed.
  const [inputKey, setInputKey] = useState(0);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (numberInvalid) return; // the number field already shows why
    setSaving(true);
    try {
      await saveBodyMetric({ date, kind, value });
      setValue(null);
      setInputKey((key) => key + 1);
      setErrors({});
      onSaved();
    } catch (error) {
      setErrors(error instanceof BodyMetricValidationError ? toFormErrors(error.errors) : { save: true });
    } finally {
      setSaving(false);
    }
  }

  const limits = BODY_METRIC_LIMITS[kind];
  const unit = BODY_METRIC_UNITS[kind];

  return (
    <Card testID="body-form">
      <Text variant="heading">{editing ? t('body.form.editEntry') : t('body.form.newEntry')}</Text>
      <TextField
        label={t('body.form.date')}
        value={date}
        onChangeText={(text) => {
          setDate(text);
          setErrors((current) => ({ ...current, date: undefined }));
        }}
        error={errors.date ? t(DATE_MESSAGES[errors.date]) : null}
        testID="body-date-input"
      />
      <NumberInput
        key={`${kind}-${inputKey}`}
        label={t('body.form.value')}
        unit={unit}
        value={value}
        rules={NO_RULES}
        onChange={({ value: next, error }) => {
          setValue(next);
          setNumberInvalid(error !== null);
          setErrors((current) => ({ ...current, value: undefined }));
        }}
        testID="body-value-input"
      />
      {errors.value ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {t(VALUE_MESSAGES[errors.value], { min: limits.min, max: limits.max, unit })}
        </Text>
      ) : null}
      {errors.save ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {t('body.errors.save')}
        </Text>
      ) : null}
      <View style={styles.actions}>
        {editing ? <Button variant="secondary" label={t('common.cancel')} onPress={onCancelEdit} /> : null}
        <Button label={t('common.save')} onPress={submit} disabled={saving} />
      </View>
    </Card>
  );
}

/** Maps the store's validation codes onto the form's fields. */
function toFormErrors(errors: BodyMetricErrors): FormErrors {
  const result: FormErrors = {};
  if (errors.date) result.date = errors.date;
  if (errors.value) result.value = errors.value;
  return result;
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: spacing.sm },
});
