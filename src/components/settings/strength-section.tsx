import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { E1RM_FORMULAS } from '@/domain/e1rm';
import { EFFORT_SCALES } from '@/domain/effort';
import { TRAINING_FOCUSES } from '@/domain/focus';
import { ROUNDING_MODES } from '@/domain/rounding';
import { useT } from '@/i18n';
import { selectE1rmFormula, selectEffortScale, selectFocus, selectRoundingMode } from '@/state';
import { useAppStore } from '@/state/app-store-context';

import {
  EFFORT_LABEL_KEYS,
  FOCUS_DESCRIPTION_KEYS,
  FOCUS_LABEL_KEYS,
  FORMULA_DESCRIPTION_KEYS,
  FORMULA_LABEL_KEYS,
  ROUNDING_DESCRIPTION_KEYS,
  ROUNDING_LABEL_KEYS,
} from '../maxes/labels';
import { Button, Card, Text } from '../ui';
import { OptionList } from './option-list';

export type StrengthSectionProps = {
  /** Opens the 1RMs screen. */
  onOpenMaxes?: () => void;
};

/**
 * Settings → Strength (SPEC-v4 §10.6): training focus, e1RM formula, effort scale, rounding mode
 * and a link to the 1RMs. Each choice applies at once; a failed save rolls back and shows an error.
 */
export function StrengthSection({ onOpenMaxes }: StrengthSectionProps) {
  const t = useT();
  const focus = useAppStore(selectFocus);
  const formula = useAppStore(selectE1rmFormula);
  const effort = useAppStore(selectEffortScale);
  const rounding = useAppStore(selectRoundingMode);
  const setFocus = useAppStore((s) => s.setFocus);
  const setE1rmFormula = useAppStore((s) => s.setE1rmFormula);
  const setEffortScale = useAppStore((s) => s.setEffortScale);
  const setRoundingMode = useAppStore((s) => s.setRoundingMode);
  const [failed, setFailed] = useState(false);

  /** Runs a settings action; a failure (already rolled back by the store) shows the error. */
  const run = (action: () => Promise<void>) => {
    setFailed(false);
    action().catch(() => setFailed(true));
  };

  return (
    <Card testID="strength-section">
      <Text variant="heading">{t('settings.strength.title')}</Text>

      <View style={styles.field}>
        <Text variant="label">{t('settings.strength.focus.label')}</Text>
        <OptionList
          label={t('settings.strength.focus.label')}
          options={TRAINING_FOCUSES.map((value) => ({
            value,
            label: t(FOCUS_LABEL_KEYS[value]),
            description: t(FOCUS_DESCRIPTION_KEYS[value]),
          }))}
          value={focus}
          onChange={(value) => run(() => setFocus(value))}
        />
      </View>

      <View style={styles.field}>
        <Text variant="label">{t('settings.strength.formula.label')}</Text>
        <OptionList
          label={t('settings.strength.formula.label')}
          options={E1RM_FORMULAS.map((value) => ({
            value,
            label: t(FORMULA_LABEL_KEYS[value]),
            description: t(FORMULA_DESCRIPTION_KEYS[value]),
          }))}
          value={formula}
          onChange={(value) => run(() => setE1rmFormula(value))}
        />
      </View>

      <View style={styles.field}>
        <Text variant="label">{t('settings.strength.effort.label')}</Text>
        <OptionList
          label={t('settings.strength.effort.label')}
          options={EFFORT_SCALES.map((value) => ({ value, label: t(EFFORT_LABEL_KEYS[value]) }))}
          value={effort}
          onChange={(value) => run(() => setEffortScale(value))}
        />
        <Text tone="secondary" variant="caption">
          {t('settings.strength.effort.hint')}
        </Text>
      </View>

      <View style={styles.field}>
        <Text variant="label">{t('settings.strength.rounding.label')}</Text>
        <OptionList
          label={t('settings.strength.rounding.label')}
          options={ROUNDING_MODES.map((value) => ({
            value,
            label: t(ROUNDING_LABEL_KEYS[value]),
            description: t(ROUNDING_DESCRIPTION_KEYS[value]),
          }))}
          value={rounding}
          onChange={(value) => run(() => setRoundingMode(value))}
        />
      </View>

      {onOpenMaxes ? (
        <Button variant="secondary" label={t('settings.strength.openMaxes')} onPress={onOpenMaxes} />
      ) : null}

      {failed ? (
        <Text tone="danger" accessibilityRole="alert">
          {t('settings.strength.error')}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({ field: { gap: spacing.sm } });
