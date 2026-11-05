import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';
import { validateProfileName } from '@/domain/validation';
import { useT } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';

import { useTheme } from '../theme-provider';
import { Button, Card, Text, TextField } from '../ui';

function useNameField(initial: string) {
  const t = useT();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  return {
    value,
    error,
    onChangeText: (text: string) => {
      setValue(text);
      setError(null);
    },
    /** Returns the name when valid; otherwise shows the localized error and returns null. */
    validate(): string | null {
      const code = validateProfileName(value);
      if (code === null) return value;
      setError(code === 'required' ? t('validation.required') : t('validation.tooLong', { max: 40 }));
      return null;
    },
    reset: () => setValue(''),
  };
}

function RenameForm({ id, name }: { id: number; name: string }) {
  const t = useT();
  const renameProfile = useAppStore((s) => s.renameProfile);
  const field = useNameField(name);
  return (
    <View style={styles.form}>
      <TextField
        label={t('settings.profiles.renameLabel')}
        value={field.value}
        onChangeText={field.onChangeText}
        error={field.error}
      />
      <Button
        variant="secondary"
        label={t('settings.profiles.rename')}
        onPress={() => {
          const valid = field.validate();
          if (valid !== null) void renameProfile(id, valid);
        }}
      />
    </View>
  );
}

function AddForm() {
  const t = useT();
  const createProfile = useAppStore((s) => s.createProfile);
  const field = useNameField('');
  return (
    <View style={styles.form}>
      <TextField
        label={t('settings.profiles.newLabel')}
        value={field.value}
        onChangeText={field.onChangeText}
        error={field.error}
      />
      <Button
        variant="secondary"
        label={t('settings.profiles.add')}
        onPress={() => {
          const valid = field.validate();
          if (valid === null) return;
          field.reset();
          void createProfile(valid);
        }}
      />
    </View>
  );
}

/** Profile selector, rename and creation (SPEC §12.2: multiple local profiles). */
export function ProfileSection() {
  const t = useT();
  const { colors } = useTheme();
  const profiles = useAppStore((s) => s.profiles);
  const active = useAppStore((s) => s.profile);
  const switchProfile = useAppStore((s) => s.switchProfile);
  if (!active) return null;
  return (
    <Card>
      <Text variant="heading">{t('settings.profiles.title')}</Text>
      <View accessibilityLabel={t('settings.profiles.select')} style={styles.list}>
        {profiles.map((profile) => {
          const selected = profile.id === active.id;
          return (
            <Pressable
              key={profile.id}
              accessibilityRole="button"
              accessibilityLabel={profile.name}
              accessibilityHint={selected ? t('settings.profiles.active') : undefined}
              accessibilityState={{ selected }}
              onPress={() => {
                if (!selected) void switchProfile(profile.id);
              }}
              style={[
                styles.row,
                {
                  backgroundColor: selected ? colors.accent : colors.surfaceRaised,
                },
              ]}>
              <Text variant="label" style={{ color: selected ? colors.onAccent : colors.text }}>
                {profile.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <RenameForm key={`${active.id}:${active.name}`} id={active.id} name={active.name} />
      <AddForm />
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs },
  row: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    justifyContent: 'center',
  },
  form: { gap: spacing.sm },
});
