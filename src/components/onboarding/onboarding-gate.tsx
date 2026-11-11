import type { ReactNode } from 'react';

import { useAppStore } from '@/state/app-store-context';

import { OnboardingScreen, type OnboardingNext } from './onboarding-screen';

export type { OnboardingNext };

const noop = () => {};

/**
 * Gate in front of the app for first-run onboarding (SPEC §10). While the store is ready and
 * the profile's onboarding is not completed, it renders the onboarding instead of `children`;
 * profiles that completed it (including v1 users) see the app straight away.
 */
export function OnboardingGate({
  children,
  onFinish = noop,
}: {
  children: ReactNode;
  /** Called after the onboarding is completed, with where to go next. */
  onFinish?: (next: OnboardingNext) => void;
}) {
  const status = useAppStore((s) => s.status);
  const completed = useAppStore((s) => s.settings?.onboardingCompleted ?? true);
  if (status === 'ready' && !completed) return <OnboardingScreen onFinish={onFinish} />;
  return <>{children}</>;
}
