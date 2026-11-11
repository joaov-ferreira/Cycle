import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';
import { DEFAULT_EXPERIENCE, EXPERIENCE_LEVELS, suggestCycle, type Experience } from '@/domain/cycle';
import { useT, type MessageKey } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';

import { useTheme } from '../theme-provider';
import { Button, Card, Screen, Text } from '../ui';

/** Where the first run goes next (SPEC §10): the template list, the importer or the home. */
export type OnboardingNext = 'templates' | 'import' | 'home';

const LABEL_KEYS = {
  beginner: 'onboarding.experience.beginner.label',
  intermediate: 'onboarding.experience.intermediate.label',
  advanced: 'onboarding.experience.advanced.label',
} as const satisfies Record<Experience, MessageKey>;

const DESCRIPTION_KEYS = {
  beginner: 'onboarding.experience.beginner.description',
  intermediate: 'onboarding.experience.intermediate.description',
  advanced: 'onboarding.experience.advanced.description',
} as const satisfies Record<Experience, MessageKey>;

/**
 * First-run onboarding (SPEC §10): the experience level, then one of three actions. Each action
 * stores the level, completes the onboarding and reports where to go next.
 */
export function OnboardingScreen({ onFinish }: { onFinish: (next: OnboardingNext) => void }) {
  const t = useT();
  const { colors } = useTheme();
  const stored = useAppStore((s) => s.settings?.experience ?? DEFAULT_EXPERIENCE);
  const setExperience = useAppStore((s) => s.setExperience);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const [experience, setLevel] = useState<Experience>(stored);
  const [failed, setFailed] = useState(false);
  const cycle = suggestCycle(experience);

  const finish = async (next: OnboardingNext) => {
    setFailed(false);
    try {
      await setExperience(experience);
      await completeOnboarding();
      onFinish(next);
    } catch {
      setFailed(true);
    }
  };

  return (
    <Screen title={t('onboarding.title')} testID="screen-onboarding">
      <Text tone="secondary">{t('onboarding.intro')}</Text>
      <Card>
        <Text variant="heading">{t('onboarding.experience.label')}</Text>
        <View style={styles.levels}>
          {EXPERIENCE_LEVELS.map((level) => {
            const selected = level === experience;
            const description = t(DESCRIPTION_KEYS[level]);
            return (
              <Pressable
                key={level}
                accessibilityRole="button"
                accessibilityLabel={t(LABEL_KEYS[level])}
                accessibilityHint={description}
                accessibilityState={{ selected }}
                onPress={() => setLevel(level)}
                style={[styles.level, { backgroundColor: selected ? colors.accent : colors.surfaceRaised }]}>
                <Text variant="label" style={{ color: selected ? colors.onAccent : colors.text }}>
                  {t(LABEL_KEYS[level])}
                </Text>
                <Text variant="caption" style={{ color: selected ? colors.onAccent : colors.textSecondary }}>
                  {description}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text tone="secondary" variant="caption">
          {t('onboarding.experience.hint', { loadWeeks: cycle.loadWeeks, deloadWeeks: cycle.deloadWeeks })}
        </Text>
      </Card>
      <Button label={t('onboarding.actions.template')} onPress={() => void finish('templates')} />
      <Button
        variant="secondary"
        label={t('onboarding.actions.import')}
        onPress={() => void finish('import')}
      />
      <Button variant="secondary" label={t('onboarding.actions.later')} onPress={() => void finish('home')} />
      {failed ? (
        <Text tone="danger" accessibilityRole="alert">
          {t('onboarding.error')}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  levels: { gap: spacing.xs },
  level: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs / 2,
    justifyContent: 'center',
  },
});
