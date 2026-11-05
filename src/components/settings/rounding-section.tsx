import { View } from 'react-native';

import { spacing } from '@/constants/theme';
import { LIFTS, type Lift } from '@/domain/lifts';
import { ROUNDING_MODES, roundLoad, type RoundingMode } from '@/domain/rounding';
import { useI18n } from '@/i18n';
import {
  selectDefaultIncrementKg,
  selectLiftIncrementOverride,
  selectRoundingMode,
} from '@/state/app-store';
import { useAppStore } from '@/state/app-store-context';

import { IncrementPicker } from '../rounding/increment-picker';
import { Card, SegmentedControl, Text } from '../ui';

/** The example from SPEC §5, shown in the preview. */
const EXAMPLE_KG = 96.25;

function LiftIncrement({ lift }: { lift: Lift }) {
  const { t } = useI18n();
  const name = t(`lifts.${lift}`);
  const override = useAppStore(selectLiftIncrementOverride(lift));
  const defaultKg = useAppStore(selectDefaultIncrementKg);
  const setLiftIncrementKg = useAppStore((s) => s.setLiftIncrementKg);
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label">{name}</Text>
      <SegmentedControl
        label={t('settings.rounding.lifts.source', { lift: name })}
        options={[
          { value: 'inherit', label: t('settings.rounding.lifts.inherit') },
          { value: 'own', label: t('settings.rounding.lifts.own') },
        ]}
        value={override === undefined ? 'inherit' : 'own'}
        onChange={(value) => void setLiftIncrementKg(lift, value === 'own' ? defaultKg : null)}
      />
      {override === undefined ? null : (
        <IncrementPicker
          label={t('settings.rounding.lifts.incrementLabel', { lift: name })}
          value={override}
          onChange={(kg) => void setLiftIncrementKg(lift, kg)}
        />
      )}
    </View>
  );
}

/**
 * Settings → increments and rounding (SPEC §5): rounding mode, the profile-wide increment,
 * optional per-lift overrides, and an example of the rounding in effect.
 */
export function RoundingSection() {
  const { t, formatKg } = useI18n();
  const mode = useAppStore(selectRoundingMode);
  const defaultKg = useAppStore(selectDefaultIncrementKg);
  const setRoundingMode = useAppStore((s) => s.setRoundingMode);
  const setIncrementKg = useAppStore((s) => s.setIncrementKg);

  const modeOptions = ROUNDING_MODES.map((value) => ({
    value,
    label: t(`settings.rounding.mode.${value}`),
  }));
  const example = t('settings.rounding.preview', {
    exact: formatKg(EXAMPLE_KG),
    rounded: formatKg(roundLoad(EXAMPLE_KG, defaultKg, mode)),
  });

  return (
    <Card>
      <Text variant="heading">{t('settings.rounding.title')}</Text>
      <Text tone="secondary">{t('settings.rounding.description')}</Text>
      <SegmentedControl<RoundingMode>
        label={t('settings.rounding.mode.label')}
        options={modeOptions}
        value={mode}
        onChange={(value) => void setRoundingMode(value)}
      />
      <Text variant="caption" tone="secondary">
        {t('settings.rounding.mode.hint')}
      </Text>
      <IncrementPicker
        label={t('settings.rounding.defaultIncrement')}
        value={defaultKg}
        onChange={(kg) => void setIncrementKg(kg)}
      />
      <Text tone="accent" tabular>
        {example}
      </Text>
      {LIFTS.map((lift) => (
        <LiftIncrement key={lift} lift={lift} />
      ))}
    </Card>
  );
}
