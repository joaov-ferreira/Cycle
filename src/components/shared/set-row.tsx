import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { layout, radius, spacing, tabularNumbers, typography } from '@/constants/theme';
import { WORKOUT_LIMITS, type LoggedSet, type SetErrors } from '@/domain/workout';
import { useI18n, type MessageKey } from '@/i18n';

import { useTheme } from '../theme-provider';
import { NumberInput } from '../ui/NumberInput';
import { Text } from '../ui/Text';

export type SetRowChange = Partial<Pick<LoggedSet, 'weightKg' | 'reps' | 'rir'>>;

export type SetRowProps = {
  /** 0-based position in the exercise; shown 1-based. */
  index: number;
  set: LoggedSet;
  /** Target reps, shown as the reps placeholder while the field is empty. */
  placeholderReps?: number | null;
  /** The same exercise's previous set, e.g. `40 kg × 12`. */
  lastTime?: { weightKg: number; reps: number } | null;
  /** Error codes of the set (SPEC §7.3), shown under the row. */
  errors?: SetErrors;
  onChange: (change: SetRowChange) => void;
  onToggleDone: () => void;
  onToggleKind: () => void;
  onRemove: () => void;
  testID?: string;
};

/** Localized message key for every error code of `SetErrors`. */
const SET_ERROR_KEYS: { [F in keyof SetErrors]-?: Record<NonNullable<SetErrors[F]>, MessageKey> } = {
  weightKg: {
    required: 'common.setErrors.weightKg.required',
    outOfRange: 'common.setErrors.weightKg.outOfRange',
    tooManyDecimals: 'common.setErrors.weightKg.tooManyDecimals',
    zeroLoadNotAllowed: 'common.setErrors.weightKg.zeroLoadNotAllowed',
  },
  reps: {
    required: 'common.setErrors.reps.required',
    outOfRange: 'common.setErrors.reps.outOfRange',
    notInteger: 'common.setErrors.reps.notInteger',
  },
  rir: {
    outOfRange: 'common.setErrors.rir.outOfRange',
    notInteger: 'common.setErrors.rir.notInteger',
  },
};

const WEIGHT_RULES = {
  min: WORKOUT_LIMITS.weightKg.min,
  max: WORKOUT_LIMITS.weightKg.max,
  maxDecimals: WORKOUT_LIMITS.weightKg.maxDecimals,
};

type IntegerFieldProps = {
  caption: string;
  label: string;
  value: number | null;
  placeholder?: number | null;
  width: number;
  onChange: (value: number | null) => void;
};

/** Whole-number input with a numeric keyboard; only digits are kept. */
function IntegerField({ caption, label, value, placeholder, width, onChange }: IntegerFieldProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.integer, { width }]}>
      <Text variant="caption" tone="secondary">
        {caption}
      </Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType="number-pad"
        inputMode="numeric"
        value={value === null ? '' : String(value)}
        placeholder={placeholder === null || placeholder === undefined ? undefined : String(placeholder)}
        placeholderTextColor={colors.textSecondary}
        onChangeText={(text) => {
          const digits = text.replace(/\D/g, '');
          onChange(digits === '' ? null : Number(digits));
        }}
        style={[
          styles.input,
          tabularNumbers,
          { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      />
    </View>
  );
}

/** One logged set (SPEC §7.3): warm-up marker, weight, reps, RIR, done, remove, with errors. */
export function SetRow({
  index,
  set,
  placeholderReps,
  lastTime,
  errors,
  onChange,
  onToggleDone,
  onToggleKind,
  onRemove,
  testID,
}: SetRowProps) {
  const { colors } = useTheme();
  const { t, formatNumber } = useI18n();
  const number = index + 1;
  const warmup = set.kind === 'warmup';
  const numberText = formatNumber(number, { maximumFractionDigits: 0 });
  const messages = (Object.keys(errors ?? {}) as (keyof SetErrors)[])
    .map((field) => {
      const code = errors?.[field];
      if (!code) return null;
      const key = (SET_ERROR_KEYS[field] as Record<string, MessageKey>)[code];
      return t(key, {
        min: WORKOUT_LIMITS.reps.min,
        max: field === 'weightKg' ? WORKOUT_LIMITS.weightKg.max : WORKOUT_LIMITS.reps.max,
        maxDecimals: WORKOUT_LIMITS.weightKg.maxDecimals,
      });
    })
    .filter((message): message is string => message !== null);

  return (
    <View testID={testID} style={styles.container}>
      {lastTime ? (
        <View style={styles.lastTime}>
          <Text variant="caption" tone="secondary">
            {t('common.lastTime')}
          </Text>
          <Text
            variant="caption"
            tone="secondary"
            tabular
            accessibilityLabel={t('common.lastTimeAccessible', {
              weight: lastTime.weightKg,
              reps: lastTime.reps,
            })}>
            {t('common.lastTimeValue', { weight: lastTime.weightKg, reps: lastTime.reps })}
          </Text>
        </View>
      ) : null}
      <View style={styles.line}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.setType', { number: numberText })}
          accessibilityValue={{ text: warmup ? t('common.warmupSet') : t('common.workingSet') }}
          onPress={onToggleKind}
          style={[styles.control, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text variant="label" tone={warmup ? 'accent' : 'primary'}>
            {warmup ? t('common.warmupMarker') : numberText}
          </Text>
        </Pressable>
        <View style={styles.weight}>
          <NumberInput
            label={t('common.setWeight', { number: numberText })}
            unit={t('common.kg')}
            value={set.weightKg}
            rules={WEIGHT_RULES}
            onChange={({ value }) => onChange({ weightKg: value })}
          />
        </View>
        <IntegerField
          caption={t('common.reps')}
          label={t('common.setReps', { number: numberText })}
          value={set.reps}
          placeholder={placeholderReps}
          width={72}
          onChange={(reps) => onChange({ reps })}
        />
        <IntegerField
          caption={t('common.rir')}
          label={t('common.setRir', { number: numberText })}
          value={set.rir}
          width={64}
          onChange={(rir) => onChange({ rir })}
        />
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={t('common.setDone', { number: numberText })}
          accessibilityState={{ checked: set.done }}
          onPress={onToggleDone}
          style={[
            styles.control,
            set.done
              ? { backgroundColor: colors.accent, borderColor: colors.accent }
              : { backgroundColor: colors.surface, borderColor: colors.border },
          ]}>
          {set.done ? <Text style={[typography.heading, { color: colors.onAccent }]}>✓</Text> : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.removeSet', { number: numberText })}
          onPress={onRemove}
          style={[styles.control, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text variant="heading">×</Text>
        </Pressable>
      </View>
      {messages.map((message) => (
        <Text
          key={message}
          variant="caption"
          tone="danger"
          accessibilityLiveRegion="polite">
          {message}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  lastTime: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  line: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  control: {
    minWidth: layout.minTouchTarget,
    minHeight: layout.minTouchTarget,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weight: { flexGrow: 1, flexShrink: 1, minWidth: 120 },
  integer: { gap: spacing.xs },
  input: {
    ...typography.body,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    textAlign: 'center',
  },
});
