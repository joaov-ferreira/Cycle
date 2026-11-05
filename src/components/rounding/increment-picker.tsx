import { useState } from 'react';
import { View } from 'react-native';

import { spacing } from '@/constants/theme';
import { INCREMENT_PRESETS_KG, INCREMENT_RULES } from '@/domain/rounding';
import { useI18n } from '@/i18n';

import { NumberInput, SegmentedControl, type SegmentOption } from '../ui';

const CUSTOM = 'custom';

export type IncrementPickerProps = {
  /** Localized name of the setting; also the accessible name of the option group. */
  label: string;
  /** Current increment in kg. */
  value: number;
  /** Called with a valid increment only (a preset, or a custom value that passes the rules). */
  onChange: (incrementKg: number) => void;
};

/**
 * Chooses a load increment: one of the presets (SPEC §5) or a custom value (0.1–25 kg in
 * 0.05 steps), entered with the locale's decimal separator.
 */
export function IncrementPicker({ label, value, onChange }: IncrementPickerProps) {
  const { t, formatNumber } = useI18n();
  const isPreset = (INCREMENT_PRESETS_KG as readonly number[]).includes(value);
  const [customMode, setCustomMode] = useState(!isPreset);

  const options: SegmentOption<string>[] = [
    ...INCREMENT_PRESETS_KG.map((kg) => ({ value: String(kg), label: formatNumber(kg) })),
    { value: CUSTOM, label: t('settings.rounding.custom') },
  ];

  function select(option: string) {
    if (option === CUSTOM) {
      setCustomMode(true);
      return;
    }
    setCustomMode(false);
    onChange(Number(option));
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <SegmentedControl
        label={label}
        options={options}
        value={customMode ? CUSTOM : String(value)}
        onChange={select}
      />
      {customMode ? (
        <NumberInput
          label={t('settings.rounding.customField', { label })}
          unit="kg"
          value={value}
          rules={INCREMENT_RULES}
          onChange={(change) => {
            if (change.value !== null) onChange(change.value);
          }}
        />
      ) : null}
    </View>
  );
}
