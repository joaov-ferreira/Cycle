import type { ReactNode } from 'react';

/**
 * Gate in front of the app for first-run onboarding. Currently a pass-through: the v2 onboarding
 * (language, theme, first plan) is built in its own stage and plugs in here.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
