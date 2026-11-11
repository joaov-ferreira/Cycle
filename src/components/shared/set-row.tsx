import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { layout, radius, spacing, tabularNumbers, typography } from '@/constants/theme';
import type { EffortScale } from '@/domain/effort';
import type { PrescribedSet } from '@/domain/prescription';
import { WORKOUT_LIMITS, type LoggedSet, type SetErrors } from '@/domain/workout';
import { formatDecimalInput, normalizeDecimalInput, useI18n, type MessageKey } from '@/i18n';

import { useTheme } from '../theme-provider';
import { NumberInput } from '../ui/NumberInput';
import { Text } from '../ui/Text';
import { displayEffort, storedRir } from './effort';
import { e1rmText, prescribedSetText } from './prescription-text';
import { Tag } from './tag';

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
  /** The effort column shows and takes RIR (default) or RPE; the change is always reported as RIR. */
  effortScale?: EffortScale;
  /** The prescribed set this row corresponds to (SPEC-v4 §7): `% → kg`, AMRAP and unverified marks. */
  prescribed?: PrescribedSet | null;
  /** The set goes beyond the prescription. */
  extra?: boolean;
  /** Strength estimate of a done set, shown as `e1RM ≈ 96 kg`. */
  estimateKg?: number | null;
  onChange: (change: SetRowChange) => void;
  onToggleDone: () => void;
  onToggleKind: () => void;
  onRemove: () => void;
  /** Adds a drop set after this set; the action shows on working sets only (SPEC-v3 §4.2). */
  onAddDrop?: () => void;
  testID?: string;
};

/**
 * Column geometry of the set row, shared with `SetRowHeader` so the captions line up: first
 * line `[set 44] [kg flex] [reps] [RIR] [done 44]`, separated by `gap`.
 */
export const SET_ROW_LAYOUT = {
  gap: spacing.xs,
  control: layout.minTouchTarget,
  reps: 56,
  rir: 48,
  weightMinWidth: 64,
} as const;

/** Localized message key for every error code of `SetErrors`. */
const SET_ERROR_KEYS: {
  [F in keyof SetErrors]-?: Record<NonNullable<SetErrors[F]>, MessageKey>;
} = {
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

/** Space around the Remove text, so its touch target reaches 44 pt. */
const REMOVE_HIT_SLOP = { top: 13, bottom: 13, left: 12, right: 12 };

type IntegerFieldProps = {
  label: string;
  value: number | null;
  placeholder?: string | null;
  width: number;
  onChange: (value: number | null) => void;
};

/** Compact whole-number input with a numeric keyboard; only digits are kept. */
function IntegerField({ label, value, placeholder, width, onChange }: IntegerFieldProps) {
  const { colors } = useTheme();
  return (
    <TextInput
      accessibilityLabel={label}
      keyboardType="number-pad"
      inputMode="numeric"
      value={value === null ? '' : String(value)}
      placeholder={placeholder ?? undefined}
      placeholderTextColor={colors.textSecondary}
      onChangeText={(text) => {
        const digits = text.replace(/\D/g, '');
        onChange(digits === '' ? null : Number(digits));
      }}
      style={[
        styles.input,
        tabularNumbers,
        {
          width,
          color: colors.text,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    />
  );
}

type EffortFieldProps = {
  label: string;
  /** The value shown, in the displayed scale. */
  value: number | null;
  width: number;
  onChange: (value: number | null) => void;
};

/**
 * Compact effort input: whole and half points in the locale's decimal format. Text that is not a
 * number is ignored; an off-step or out-of-range number is passed on so the domain can name it.
 */
function EffortField({ label, value, width, onChange }: EffortFieldProps) {
  const { colors } = useTheme();
  const { locale } = useI18n();
  const [text, setText] = useState(() => formatDecimalInput(value, locale));
  const textRef = useRef(text);
  const lastValueRef = useRef(value);

  const valueOf = (candidate: string): number | null => {
    const canonical = normalizeDecimalInput(candidate, locale);
    return canonical === null ? null : Number(canonical);
  };

  // Follows a value changed from outside; partial input such as `1,` stays as typed.
  useEffect(() => {
    if (lastValueRef.current === value) return;
    lastValueRef.current = value;
    if (valueOf(textRef.current) === value) return;
    const formatted = formatDecimalInput(value, locale);
    textRef.current = formatted;
    setText(formatted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, locale]);

  return (
    <TextInput
      accessibilityLabel={label}
      keyboardType="decimal-pad"
      inputMode="decimal"
      value={text}
      placeholderTextColor={colors.textSecondary}
      onChangeText={(next) => {
        if (next.trim() === '') {
          textRef.current = '';
          setText('');
          onChange(null);
          return;
        }
        const parsed = valueOf(next);
        if (parsed === null) return;
        textRef.current = next;
        setText(next);
        onChange(parsed);
      }}
      style={[
        styles.input,
        tabularNumbers,
        {
          width,
          color: colors.text,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    />
  );
}

/**
 * One logged set (SPEC §7.3). The first line holds every control and never wraps; the second
 * line carries the last time and the Remove action; errors sit below.
 */
export function SetRow({
  index,
  set,
  placeholderReps,
  lastTime,
  errors,
  effortScale = 'rir',
  prescribed,
  extra = false,
  estimateKg,
  onChange,
  onToggleDone,
  onToggleKind,
  onRemove,
  onAddDrop,
  testID,
}: SetRowProps) {
  const { colors } = useTheme();
  const i18n = useI18n();
  const { t, formatNumber } = i18n;
  const rpe = effortScale === 'rpe';
  const number = index + 1;
  const warmup = set.kind === 'warmup';
  const drop = set.kind === 'drop';
  // A drop set keeps its parent's number: its inputs are named by kind instead.
  const labels = drop
    ? {
        weight: t('workout.dropSetWeight'),
        reps: t('workout.dropSetReps'),
        rir: t(rpe ? 'workout.dropSetRpe' : 'workout.dropSetRir'),
        done: t('workout.dropSetDone'),
        remove: t('workout.removeDropSet'),
      }
    : null;
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

  const repsPlaceholder =
    placeholderReps === null || placeholderReps === undefined
      ? null
      : prescribed?.amrap
        ? t('common.repsAmrap', { reps: placeholderReps })
        : String(placeholderReps);
  const loadText = prescribed ? prescribedSetText(i18n, prescribed) : null;
  const showMeta = loadText !== null || !!prescribed?.amrap || !!prescribed?.unverified || extra || estimateKg != null;

  return (
    <View testID={testID} style={[styles.container, drop && styles.dropIndent]}>
      <View testID="set-row-controls" style={styles.line}>
        {drop ? (
          // The marker is not an action: pressing it does nothing.
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('workout.dropSet')}
            disabled
            style={[styles.control, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text variant="label" tone="accent">
              {t('workout.dropMarker')}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.setType', { number: numberText })}
            accessibilityValue={{
              text: warmup ? t('common.warmupSet') : t('common.workingSet'),
            }}
            onPress={onToggleKind}
            style={[styles.control, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text variant="label" tone={warmup ? 'accent' : 'primary'}>
              {warmup ? t('common.warmupMarker') : numberText}
            </Text>
          </Pressable>
        )}
        <View testID="set-row-weight" style={styles.weight}>
          <NumberInput
            label={labels?.weight ?? t('common.setWeight', { number: numberText })}
            value={set.weightKg}
            rules={WEIGHT_RULES}
            onChange={({ value }) => onChange({ weightKg: value })}
            compact
          />
        </View>
        <IntegerField
          label={labels?.reps ?? t('common.setReps', { number: numberText })}
          value={set.reps}
          placeholder={repsPlaceholder}
          width={SET_ROW_LAYOUT.reps}
          onChange={(reps) => onChange({ reps })}
        />
        <EffortField
          label={labels?.rir ?? t(rpe ? 'common.setRpe' : 'common.setRir', { number: numberText })}
          value={displayEffort(effortScale, set.rir)}
          width={SET_ROW_LAYOUT.rir}
          onChange={(value) => onChange({ rir: storedRir(effortScale, value) })}
        />
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={labels?.done ?? t('common.setDone', { number: numberText })}
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
      </View>
      {showMeta ? (
        <View testID="set-row-meta" style={styles.meta}>
          {loadText !== null ? (
            <Text variant="caption" tone="secondary" tabular>
              {loadText}
            </Text>
          ) : null}
          {prescribed?.amrap ? <Tag label={t('common.amrap')} /> : null}
          {prescribed?.unverified ? <Tag label={t('common.unverified')} tone="danger" /> : null}
          {extra ? <Tag label={t('common.extraSet')} tone="neutral" /> : null}
          {estimateKg != null ? (
            <Text variant="caption" tone="accent" tabular>
              {e1rmText(i18n, estimateKg)}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={styles.footer}>
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
              {t('common.lastTimeValue', {
                weight: lastTime.weightKg,
                reps: lastTime.reps,
              })}
            </Text>
          </View>
        ) : (
          <View />
        )}
        <View style={styles.actions}>
          {onAddDrop && set.kind === 'working' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('workout.addDropSet')}
              hitSlop={REMOVE_HIT_SLOP}
              onPress={onAddDrop}>
              <Text variant="caption" tone="accent" style={styles.remove}>
                {t('workout.addDrop')}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={labels?.remove ?? t('common.removeSet', { number: numberText })}
            hitSlop={REMOVE_HIT_SLOP}
            onPress={onRemove}>
            <Text variant="caption" tone="secondary" style={styles.remove}>
              {t('common.remove')}
            </Text>
          </Pressable>
        </View>
      </View>
      {messages.map((message) => (
        <Text key={message} variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {message}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  dropIndent: { marginLeft: spacing.lg },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SET_ROW_LAYOUT.gap,
  },
  control: {
    minWidth: SET_ROW_LAYOUT.control,
    minHeight: SET_ROW_LAYOUT.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weight: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: SET_ROW_LAYOUT.weightMinWidth,
  },
  input: {
    ...typography.body,
    // Web: an <input> has an intrinsic minimum width and shrinks by default; pin it to its column.
    minWidth: 0,
    flexGrow: 0,
    flexShrink: 0,
    minHeight: SET_ROW_LAYOUT.control,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.md,
    textAlign: 'center',
  },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  lastTime: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    flexShrink: 1,
  },
  remove: { textDecorationLine: 'underline' },
});
