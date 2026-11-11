import { useState } from 'react';

import type { NumberRules } from '@/domain/number-validation';
import { validateMaxKg, type ReferenceMaxError } from '@/domain/reference-max';
import { useT, type MessageKey } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';

import { Button, Card, NumberInput, Text } from '../ui';
import { EstimateFromSet } from './estimate-from-set';

const ERROR_KEYS = {
  required: 'maxes.errors.required',
  outOfRange: 'maxes.errors.outOfRange',
  tooManyDecimals: 'maxes.errors.tooManyDecimals',
} as const satisfies Record<ReferenceMaxError, MessageKey>;

/** The number field only reports what it cannot read; the 1RM rules are checked on save. */
const NO_RULES: NumberRules = {};

/**
 * Adds a 1RM record for one exercise (origin `manual`): a kg field, or "Estimate from a set"
 * whose value fills the field. Saving validates with `validateMaxKg` and goes through the store.
 */
export function MaxForm({ exerciseId }: { exerciseId: string }) {
  const t = useT();
  const addReferenceMax = useAppStore((s) => s.addReferenceMax);
  const [kg, setKg] = useState<number | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [saving, setSaving] = useState(false);
  // Remounts the estimate form after a save so it starts empty.
  const [round, setRound] = useState(0);

  async function save() {
    const reason = unreadable ? 'outOfRange' : validateMaxKg(kg);
    if (reason) {
      setError(ERROR_KEYS[reason]);
      return;
    }
    setSaving(true);
    try {
      await addReferenceMax({ exerciseId, kg: kg as number, origin: 'manual' });
      setKg(null);
      setEstimating(false);
      setRound((r) => r + 1);
      setError(null);
    } catch {
      setError('maxes.errors.save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card testID="max-form">
      <Text variant="heading">{t('maxes.detail.addTitle')}</Text>
      <NumberInput
        label={t('maxes.detail.kgLabel')}
        unit="kg"
        value={kg}
        rules={NO_RULES}
        onChange={({ value, error: readError }) => {
          setKg(value);
          setUnreadable(readError !== null);
          setError(null);
        }}
        testID="max-kg-input"
      />
      <Button
        variant="secondary"
        label={estimating ? t('maxes.estimate.hide') : t('maxes.estimate.toggle')}
        onPress={() => setEstimating((open) => !open)}
      />
      {estimating ? (
        <EstimateFromSet
          key={round}
          onUse={(value) => {
            setKg(value);
            setUnreadable(false);
            setError(null);
          }}
          testIDPrefix="max-estimate"
        />
      ) : null}
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite" accessibilityRole="alert">
          {t(error)}
        </Text>
      ) : null}
      <Button label={t('maxes.detail.save')} onPress={() => void save()} disabled={saving} />
    </Card>
  );
}
