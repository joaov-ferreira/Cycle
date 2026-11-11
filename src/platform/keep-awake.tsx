import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { usePathname } from 'expo-router';
import { useEffect } from 'react';

import { useAppStore } from '@/state/app-store-context';

const TAG = 'cycle-logging';

/** True for the Workout tab (`/workout`, also inside the `(tabs)` group). */
export function isWorkoutRoute(pathname: string): boolean {
  return /^\/(\(tabs\)\/)?workout\/?$/.test(pathname);
}

/**
 * Keeps the screen on only while the Workout tab is shown, a workout is in progress and the
 * "Keep screen on" setting is on. Releases it otherwise and on unmount.
 */
export function KeepAwakeWhileLogging() {
  const pathname = usePathname();
  const inProgress = useAppStore((s) => s.currentWorkout !== null);
  const setting = useAppStore((s) => s.settings?.keepAwake === true);
  const active = inProgress && setting && isWorkoutRoute(pathname);

  useEffect(() => {
    if (!active) return;
    activateKeepAwakeAsync(TAG).catch(() => undefined);
    return () => {
      try {
        void Promise.resolve(deactivateKeepAwake(TAG)).catch(() => undefined);
      } catch {
        // Releasing the screen lock is best effort.
      }
    };
  }, [active]);

  return null;
}
