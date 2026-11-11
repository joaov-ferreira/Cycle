import { useRootNavigationState, useRouter, type Href } from 'expo-router';
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
 * `programs` opens the strength program library. `home` needs no navigation: the tabs are already the first screen.
 */
export function OnboardingNavigation({ next, onDone }: OnboardingNavigationProps) {
  const router = useRouter();
  const rootState = useRootNavigationState();
  const navigatorReady = rootState?.key !== undefined;

  useEffect(() => {
    if (next === null || !navigatorReady) return;
    if (next === 'templates') router.push('/plans/templates');
    if (next === 'import') router.push('/plans/import');
    // The strength programs live in another stage's route files; typed routes may not know it yet.
    if (next === 'programs') router.push('/programs' as Href);
    onDone();
  }, [next, navigatorReady, router, onDone]);

  return null;
}
