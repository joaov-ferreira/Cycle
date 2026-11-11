import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';
import { E1RM_FORMULAS, estimate1rm, type E1rmFormula } from '@/domain/e1rm';
import { floorToHalfKg } from '@/domain/reference-max';
import { DEFAULT_INCREMENT_KG, INCREMENT_PRESETS_KG, roundLoad } from '@/domain/rounding';
import { useI18n } from '@/i18n';
import { selectAllExercises, selectE1rmFormula, selectRoundingMode } from '@/state';
import { useAppStore } from '@/state/app-store-context';

import { Chip, ExerciseSelectModal, exerciseName } from '../shared';
import { useTheme } from '../theme-provider';
import { Button, Card, Screen, Text } from '../ui';
import { CONFIDENCE_KEYS, FORMULA_LABEL_KEYS, ROUNDING_LABEL_KEYS } from './labels';
import { SetInputs, type SetValues } from './set-inputs';

/** Percentages of the load table: 50 % to 100 % in steps of 5 %. */
const PERCENTS = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100] as const;

export type CalculatorScreenProps = { onBack?: () => void };

/**
 * 1RM calculator (SPEC-v4 §10.5): a set gives the estimate under the three formulas (the profile's
 * highlighted), a table of 50-100 % of the selected formula's estimate rounded to a chosen
 * increment with the profile's rounding mode, and "Save as 1RM of…". Needs no profile data.
 */
export function CalculatorScreen({ onBack }: CalculatorScreenProps) {
  const { t, locale, formatKg, formatPercent } = useI18n();
  const { colors } = useTheme();
  const profileFormula = useAppStore(selectE1rmFormula);
  const roundingMode = useAppStore(selectRoundingMode);
  const exercises = useAppStore(selectAllExercises);
  const addReferenceMax = useAppStore((s) => s.addReferenceMax);

  const [values, setValues] = useState<SetValues>({ weightKg: null, reps: null, rir: 0 });
  const [chosen, setChosen] = useState<E1rmFormula | null>(null);
  const [increment, setIncrement] = useState<number>(DEFAULT_INCREMENT_KG);
  const [picking, setPicking] = useState(false);
  const [status, setStatus] = useState<{ kind: 'saved'; text: string } | { kind: 'error' } | null>(null);

  const formula = chosen ?? profileFormula;
  const pickable = useMemo(() => exercises.filter((e) => !e.archived), [exercises]);
  const complete = values.weightKg !== null && values.reps !== null && values.rir !== null;
  const estimates = E1RM_FORMULAS.map((id) => ({
    id,
    estimate: complete ? estimate1rm(values.weightKg as number, values.reps as number, values.rir as number, id) : null,
  }));
  const selected = estimates.find((e) => e.id === formula)?.estimate ?? null;

  async function save(exerciseId: string, name: string) {
    if (!selected) return;
    const kg = floorToHalfKg(selected.kg);
    try {
      await addReferenceMax({ exerciseId, kg, origin: 'fromE1rm' });
      setStatus({ kind: 'saved', text: t('maxes.calculator.saved', { value: formatKg(kg), name }) });
    } catch {
      setStatus({ kind: 'error' });
    }
  }

  return (
    <Screen title={t('maxes.calculator.title')} testID="screen-calculator">
      {onBack ? <Button variant="secondary" label={t('common.back')} onPress={onBack} /> : null}
      <Text tone="secondary">{t('maxes.calculator.intro')}</Text>

      <Card>
        <SetInputs onChange={setValues} testIDPrefix="calc" />
      </Card>

      {complete ? (
        <Card>
          <Text variant="heading">{t('maxes.calculator.estimatesTitle')}</Text>
          <View accessibilityLabel={t('maxes.calculator.formulaGroup')} style={styles.formulas}>
            {estimates.map(({ id, estimate }) => {
              const label = t(FORMULA_LABEL_KEYS[id]);
              const isSelected = id === formula;
              const tags = [
                id === profileFormula ? t('maxes.calculator.yourFormula') : null,
                estimate?.confidence === 'low' ? t('maxes.calculator.lowConfidence') : null,
              ].filter((tag): tag is string => tag !== null);
              const value = estimate ? formatKg(estimate.kg, { maximumFractionDigits: 1 }) : t('maxes.calculator.noEstimate');
              return (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={t('maxes.calculator.estimateRow', { formula: label, value })}
                  accessibilityHint={tags.length > 0 ? tags.join(', ') : undefined}
                  accessibilityState={{ selected: isSelected }}
                  disabled={estimate === null}
                  onPress={() => setChosen(id)}
                  style={[
                    styles.formula,
                    {
                      backgroundColor: isSelected ? colors.surfaceRaised : colors.surface,
                      borderColor: id === profileFormula ? colors.accent : colors.border,
                    },
                  ]}>
                  <View style={styles.formulaText}>
                    <Text variant="label">{label}</Text>
                    {tags.map((tag) => (
                      <Text key={tag} variant="caption" tone="secondary">
                        {tag}
                      </Text>
                    ))}
                  </View>
                  <Text variant="heading">{value}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      ) : null}

      {selected ? (
        <Card testID="calc-table">
          <Text variant="heading">{t('maxes.calculator.tableTitle')}</Text>
          <Text variant="label">{t('maxes.calculator.increment')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            accessibilityLabel={t('maxes.calculator.incrementGroup')}
            contentContainerStyle={styles.chips}>
            {INCREMENT_PRESETS_KG.map((preset) => (
              <Chip
                key={preset}
                label={formatKg(preset, { minimumFractionDigits: 0 })}
                selected={preset === increment}
                onPress={() => setIncrement(preset)}
              />
            ))}
          </ScrollView>
          <Text variant="caption" tone="secondary">
            {t('maxes.calculator.rounding', { mode: t(ROUNDING_LABEL_KEYS[roundingMode]) })}
          </Text>
          <View style={styles.tableHeader}>
            <Text variant="caption" tone="secondary">
              {t('maxes.calculator.percentHeader')}
            </Text>
            <Text variant="caption" tone="secondary">
              {t('maxes.calculator.loadHeader')}
            </Text>
          </View>
          {PERCENTS.map((percent) => (
            <View key={percent} testID={`calc-row-${percent}`} style={styles.tableRow}>
              <Text>{formatPercent(percent / 100)}</Text>
              <Text variant="label">
                {formatKg(roundLoad((selected.kg * percent) / 100, increment, roundingMode), { minimumFractionDigits: 0 })}
              </Text>
            </View>
          ))}
          <Button label={t('maxes.calculator.saveAs')} onPress={() => setPicking(true)} />
        </Card>
      ) : (
        <Button label={t('maxes.calculator.saveAs')} onPress={() => setPicking(true)} disabled />
      )}

      {status ? (
        <Text
          tone={status.kind === 'error' ? 'danger' : 'secondary'}
          accessibilityLiveRegion="polite"
          accessibilityRole={status.kind === 'error' ? 'alert' : undefined}>
          {status.kind === 'error' ? t('maxes.calculator.saveError') : status.text}
        </Text>
      ) : null}

      <ExerciseSelectModal
        visible={picking}
        title={t('maxes.calculator.pickerTitle')}
        exercises={pickable}
        onSelect={(exercise) => {
          setPicking(false);
          void save(exercise.id, exerciseName(exercise, locale));
        }}
        onClose={() => setPicking(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  formulas: { gap: spacing.sm },
  formula: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  formulaText: { flex: 1, gap: spacing.xs },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', minHeight: 28, alignItems: 'center' },
});
