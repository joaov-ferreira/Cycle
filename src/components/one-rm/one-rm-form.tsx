import { useState } from 'react';
import { View } from 'react-native';

import { spacing } from '@/constants/theme';
import { LIFTS, type Lift } from '@/domain/lifts';
import { REFERENCE_1RM_RULES } from '@/domain/validation';
import { useT } from '@/i18n';
import type { OneRmValues } from '@/state/app-store';

import { Button, NumberInput, type NumberInputChange } from '../ui';

export type OneRmFormProps = {
  /** Starting value of each lift's field (`null` = empty). */
  initial: Record<Lift, number | null>;
  submitLabel: string;
  /** Called with the lifts that have a valid value; empty lifts are left out. */
  onSubmit: (values: OneRmValues) => void;
};

/** One kg field per lift (SPEC §2). Submission is blocked while any field is invalid. */
export function OneRmForm({ initial, submitLabel, onSubmit }: OneRmFormProps) {
  const t = useT();
  const [changes, setChanges] = useState<Record<Lift, NumberInputChange>>(() => ({
    bench: { value: initial.bench, error: null },
    squat: { value: initial.squat, error: null },
    deadlift: { value: initial.deadlift, error: null },
  }));
  const hasError = LIFTS.some((lift) => changes[lift].error !== null);

  function submit() {
    const values: OneRmValues = {};
    for (const lift of LIFTS) {
      const { value } = changes[lift];
      if (value !== null) values[lift] = value;
    }
    onSubmit(values);
  }

  return (
    <View style={{ gap: spacing.md }}>
      {LIFTS.map((lift) => (
        <NumberInput
          key={lift}
          label={t('oneRm.fieldLabel', { lift: t(`lifts.${lift}`) })}
          unit="kg"
          value={initial[lift]}
          rules={REFERENCE_1RM_RULES}
          onChange={(change) => setChanges((previous) => ({ ...previous, [lift]: change }))}
        />
      ))}
      <Button label={submitLabel} onPress={submit} disabled={hasError} />
    </View>
  );
}
