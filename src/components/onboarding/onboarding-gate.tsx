import type { ReactNode } from 'react';

import { useT } from '@/i18n';
import { selectNeedsOnboarding } from '@/state/app-store';
import { useAppStore } from '@/state/app-store-context';

import { OneRmForm } from '../one-rm/one-rm-form';
import { Button, Card, Screen, Text } from '../ui';

const NO_VALUES = { bench: null, squat: null, deadlift: null };

function OnboardingScreen() {
  const t = useT();
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  return (
    <Screen title={t('onboarding.title')} testID="screen-onboarding">
      <Text tone="secondary">{t('onboarding.intro')}</Text>
      <Card>
        <OneRmForm
          initial={NO_VALUES}
          submitLabel={t('onboarding.start')}
          onSubmit={(values) => void completeOnboarding(values)}
        />
        <Text variant="caption" tone="secondary">
          {t('oneRm.unitHint')}
        </Text>
      </Card>
      <Button
        variant="secondary"
        label={t('onboarding.skip')}
        onPress={() => void completeOnboarding({})}
      />
    </Screen>
  );
}

/** Shows the first-run 1RM onboarding (SPEC §2) until it is completed or skipped. */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const needsOnboarding = useAppStore(selectNeedsOnboarding);
  return needsOnboarding ? <OnboardingScreen /> : <>{children}</>;
}
