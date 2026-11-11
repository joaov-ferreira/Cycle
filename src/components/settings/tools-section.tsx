import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { layout, spacing } from '@/constants/theme';
import { BAR_LIMITS, STANDARD_PLATES_KG } from '@/domain/plates';
import { REST_DEFAULT_LIMITS } from '@/domain/rest-timer';
import { useI18n } from '@/i18n';
import { SettingsValidationError } from '@/state/errors';
import { useAppStore } from '@/state/app-store-context';

import { Chip } from '../shared/chip';
import { Stepper } from '../shared/stepper';
import { Card, Text } from '../ui';

/** `90` → `1:30`. */
export function formatRest(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function SwitchRow({
  label,
  hint,
  value,
  onValueChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchText}>
        <Text variant="label">{label}</Text>
        <Text tone="secondary" variant="caption">
          {hint}
        </Text>
      </View>
      <Switch
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value }}
        value={value}
        onValueChange={onValueChange}
        style={styles.switch}
      />
    </View>
  );
}

/** Gym tools (SPEC-v3 §1–§2): default rest, rest notifications, keep screen on, bar and plates. */
export function ToolsSection() {
  const { t, formatKg } = useI18n();
  const settings = useAppStore((s) => s.settings);
  const setDefaultRestSeconds = useAppStore((s) => s.setDefaultRestSeconds);
  const setRestNotifications = useAppStore((s) => s.setRestNotifications);
  const setKeepAwake = useAppStore((s) => s.setKeepAwake);
  const setBarKg = useAppStore((s) => s.setBarKg);
  const setPlatesKg = useAppStore((s) => s.setPlatesKg);
  const [error, setError] = useState<string | null>(null);

  if (!settings) return null;

  /** Runs a settings action; a rejected value shows its localized message. */
  const run = (action: () => Promise<void>) => {
    setError(null);
    action().catch((e: unknown) => {
      if (!(e instanceof SettingsValidationError)) return;
      if (e.field === 'defaultRestSeconds') setError(t('settings.tools.errors.rest'));
      else if (e.field === 'barKg') setError(t('settings.tools.errors.bar'));
      else setError(t('settings.tools.errors.plates'));
    });
  };

  const togglePlate = (plate: number) => {
    const selected = settings.platesKg.includes(plate);
    const next = selected
      ? settings.platesKg.filter((p) => p !== plate)
      : STANDARD_PLATES_KG.filter((p) => p === plate || settings.platesKg.includes(p));
    if (next.length === 0) {
      setError(t('settings.tools.errors.plates'));
      return;
    }
    run(() => setPlatesKg([...next]));
  };

  return (
    <Card>
      <Text variant="heading">{t('settings.tools.title')}</Text>

      <View style={styles.field}>
        <Text variant="label">{t('settings.tools.rest')}</Text>
        <Stepper
          label={t('settings.tools.rest')}
          value={settings.defaultRestSeconds}
          min={REST_DEFAULT_LIMITS.min}
          max={REST_DEFAULT_LIMITS.max}
          step={REST_DEFAULT_LIMITS.step}
          format={(v) => (v === 0 ? t('settings.tools.restOff') : formatRest(v))}
          onChange={(v) => run(() => setDefaultRestSeconds(v))}
        />
      </View>

      <SwitchRow
        label={t('settings.tools.restNotifications')}
        hint={t('settings.tools.restNotificationsHint')}
        value={settings.restNotifications}
        onValueChange={(v) => run(() => setRestNotifications(v))}
      />
      <SwitchRow
        label={t('settings.tools.keepAwake')}
        hint={t('settings.tools.keepAwakeHint')}
        value={settings.keepAwake}
        onValueChange={(v) => run(() => setKeepAwake(v))}
      />

      <View style={styles.field}>
        <Text variant="label">{t('settings.tools.bar')}</Text>
        <Stepper
          label={t('settings.tools.bar')}
          value={settings.barKg}
          min={BAR_LIMITS.min}
          max={BAR_LIMITS.max}
          step={BAR_LIMITS.step}
          format={(v) => formatKg(v, { minimumFractionDigits: 0 })}
          onChange={(v) => run(() => setBarKg(v))}
        />
      </View>

      <View style={styles.field}>
        <Text variant="label">{t('settings.tools.plates')}</Text>
        <View accessibilityLabel={t('settings.tools.plates')} style={styles.chips}>
          {STANDARD_PLATES_KG.map((plate) => (
            <Chip
              key={plate}
              label={formatKg(plate, { minimumFractionDigits: 0 })}
              selected={settings.platesKg.includes(plate)}
              onPress={() => togglePlate(plate)}
            />
          ))}
        </View>
      </View>

      {error ? (
        <Text tone="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: layout.minTouchTarget },
  switchText: { flex: 1, gap: spacing.xs },
  switch: { minHeight: layout.minTouchTarget },
});
