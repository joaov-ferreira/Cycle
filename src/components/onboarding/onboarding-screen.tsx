import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { DEFAULT_EXPERIENCE, EXPERIENCE_LEVELS, suggestCycle, type Experience } from '@/domain/cycle';
import { DEFAULT_TRAINING_FOCUS, TRAINING_FOCUSES, type TrainingFocus } from '@/domain/focus';
import { useT, type MessageKey } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';

import { FOCUS_DESCRIPTION_KEYS, FOCUS_LABEL_KEYS } from '../maxes/labels';
import { OptionList } from '../settings/option-list';
import { Button, Card, Screen, Text } from '../ui';
import { LiftsStep, filledLifts, initialLifts, type LiftRow } from './lifts-step';

/**
 * Where the first run goes next (SPEC §10, SPEC-v4 §10.1): the template list, the importer, the
 * strength programs or the home.
 */
export type OnboardingNext = 'templates' | 'import' | 'programs' | 'home';

type Step = 'focus' | 'experience' | 'lifts';

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
 * First-run onboarding (SPEC-v4 §10.1): the training focus, the experience level and, on the
 * strength path, "Your lifts"; the last step offers the ways to start. Each action stores the
 * choices, completes the onboarding and reports where to go next.
 */
export function OnboardingScreen({ onFinish }: { onFinish: (next: OnboardingNext) => void }) {
  const t = useT();
  const stored = useAppStore((s) => s.settings?.experience ?? DEFAULT_EXPERIENCE);
  const setExperience = useAppStore((s) => s.setExperience);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const [step, setStep] = useState<Step>('focus');
  const [focus, setFocus] = useState<TrainingFocus>(DEFAULT_TRAINING_FOCUS);
  const [experience, setLevel] = useState<Experience>(stored);
  const [lifts, setLifts] = useState<LiftRow[]>(initialLifts);
  const [failed, setFailed] = useState(false);
  const cycle = suggestCycle(experience);
  const strength = focus === 'strength';

  const finish = async (next: OnboardingNext) => {
    setFailed(false);
    try {
      await setExperience(experience);
      await completeOnboarding({ focus, maxes: strength ? filledLifts(lifts) : [] });
      onFinish(next);
    } catch {
      setFailed(true);
    }
  };

  const actions = (
    <>
      {strength ? (
        <Button label={t('onboarding.actions.programs')} onPress={() => void finish('programs')} />
      ) : null}
      <Button
        variant={strength ? 'secondary' : 'primary'}
        label={t('onboarding.actions.template')}
        onPress={() => void finish('templates')}
      />
      <Button variant="secondary" label={t('onboarding.actions.import')} onPress={() => void finish('import')} />
      <Button variant="secondary" label={t('onboarding.actions.later')} onPress={() => void finish('home')} />
    </>
  );

  return (
    <Screen title={t('onboarding.title')} testID="screen-onboarding">
      {step === 'focus' ? (
        <>
          <Text tone="secondary">{t('onboarding.intro')}</Text>
          <Card>
            <Text variant="heading">{t('onboarding.focus.title')}</Text>
            <OptionList
              label={t('onboarding.focus.title')}
              options={TRAINING_FOCUSES.map((value) => ({
                value,
                label: t(FOCUS_LABEL_KEYS[value]),
                description: t(FOCUS_DESCRIPTION_KEYS[value]),
              }))}
              value={focus}
              onChange={setFocus}
            />
          </Card>
          <Button label={t('onboarding.next')} onPress={() => setStep('experience')} />
        </>
      ) : null}

      {step === 'experience' ? (
        <>
          <Card>
            <Text variant="heading">{t('onboarding.experience.label')}</Text>
            <OptionList
              label={t('onboarding.experience.label')}
              options={EXPERIENCE_LEVELS.map((level) => ({
                value: level,
                label: t(LABEL_KEYS[level]),
                description: t(DESCRIPTION_KEYS[level]),
              }))}
              value={experience}
              onChange={setLevel}
            />
            <Text tone="secondary" variant="caption">
              {t('onboarding.experience.hint', { loadWeeks: cycle.loadWeeks, deloadWeeks: cycle.deloadWeeks })}
            </Text>
          </Card>
          {strength ? <Button label={t('onboarding.next')} onPress={() => setStep('lifts')} /> : actions}
          <Button variant="secondary" label={t('common.back')} onPress={() => setStep('focus')} />
        </>
      ) : null}

      {step === 'lifts' ? (
        <>
          <LiftsStep rows={lifts} onChange={setLifts} />
          <View style={styles.actions}>{actions}</View>
          <Button variant="secondary" label={t('common.back')} onPress={() => setStep('experience')} />
        </>
      ) : null}

      {failed ? (
        <Text tone="danger" accessibilityRole="alert">
          {t('onboarding.error')}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.lg },
});
