import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { rirFromRpe } from '@/domain/effort';
import type { NumberRules } from '@/domain/number-validation';
import { REFERENCE_MAX_LIMITS } from '@/domain/reference-max';
import { useT } from '@/i18n';
import { selectEffortScale } from '@/state';
import { useAppStore } from '@/state/app-store-context';

import { NumberInput, Text } from '../ui';
import { EFFORT_HINT_KEYS, EFFORT_LABEL_KEYS } from './labels';

/** A set as typed; every field is `null` while it is empty or invalid (an empty effort counts as RIR 0). */
export type SetValues = { weightKg: number | null; reps: number | null; rir: number | null };

const WEIGHT_RULES: NumberRules = {
  min: 0,
  minExclusive: true,
  max: REFERENCE_MAX_LIMITS.max,
  maxDecimals: 2,
};
const REPS_RULES: NumberRules = { min: 1, max: 50, maxDecimals: 0 };
const EFFORT_RULES: NumberRules = { min: 0, max: 10, maxDecimals: 1, step: 0.5 };

export type SetInputsProps = {
  onChange: (values: SetValues) => void;
  /** Prefix of the field test ids. */
  testIDPrefix?: string;
};

/**
 * The three fields of "a set" (weight, reps, effort in the profile's scale). Reports the set in
 * the store's terms: effort is always converted to RIR, an empty effort counts as a set to
 * failure, and a field that is empty or invalid reports `null`.
 */
export function SetInputs({ onChange, testIDPrefix = 'set' }: SetInputsProps) {
  const t = useT();
  const scale = useAppStore(selectEffortScale);
  const [weight, setWeight] = useState<number | null>(null);
  const [reps, setReps] = useState<number | null>(null);
  // `effort` is the typed number (or null); `effortInvalid` marks text that could not be read.
  const [effort, setEffort] = useState<number | null>(null);
  const [effortInvalid, setEffortInvalid] = useState(false);

  const rir = effortInvalid ? null : effort === null ? 0 : scale === 'rpe' ? rirFromRpe(effort) : effort;
  const callback = useRef(onChange);
  callback.current = onChange;
  useEffect(() => {
    callback.current({ weightKg: weight, reps, rir });
  }, [weight, reps, rir]);

  return (
    <View style={styles.fields}>
      <NumberInput
        label={t('maxes.estimate.weight')}
        unit="kg"
        value={weight}
        rules={WEIGHT_RULES}
        onChange={({ value }) => setWeight(value)}
        testID={`${testIDPrefix}-weight`}
      />
      <NumberInput
        label={t('maxes.estimate.reps')}
        value={reps}
        rules={REPS_RULES}
        onChange={({ value }) => setReps(value)}
        testID={`${testIDPrefix}-reps`}
      />
      <NumberInput
        label={t(EFFORT_LABEL_KEYS[scale])}
        value={effort}
        rules={EFFORT_RULES}
        onChange={({ value, error }) => {
          setEffort(value);
          setEffortInvalid(error !== null);
        }}
        testID={`${testIDPrefix}-effort`}
      />
      <Text variant="caption" tone="secondary">
        {t(EFFORT_HINT_KEYS[scale])}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ fields: { gap: spacing.md } });
