import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect } from 'react';

import type { OnboardingNext } from './onboarding-screen';

export type OnboardingNavigationProps = {
  /** Where to go once the onboarding is done; `null` while nothing is pending. */
  next: OnboardingNext | null;
  /** Called once the destination is handled, so the pending value can be cleared. */
  onDone: () => void;
};

/**
 * Carries out the onboarding's destination. It waits until the root navigator is mounted
 * (`useRootNavigationState` has a key) instead of navigating synchronously in the gate's handler.
 * `home` needs no navigation: the tabs are already the first screen.
 */
export function OnboardingNavigation({ next, onDone }: OnboardingNavigationProps) {
  const router = useRouter();
  const rootState = useRootNavigationState();
  const navigatorReady = rootState?.key !== undefined;

  useEffect(() => {
    if (next === null || !navigatorReady) return;
    if (next === 'templates') router.push('/plans/templates');
    if (next === 'import') router.push('/plans/import');
    onDone();
  }, [next, navigatorReady, router, onDone]);

  return null;
}
