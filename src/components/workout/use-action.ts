import { useCallback, useEffect, useRef, useState } from 'react';

import { useT } from '@/i18n';

import { actionErrorMessage } from './action-error';

/**
 * Runs store actions without ever letting a rejection escape: the rejection becomes a localized
 * message in `error`. `run` resolves to `true` when the action succeeded.
 */
export function useAction() {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (job: () => Promise<unknown>): Promise<boolean> => {
      try {
        await job();
        if (mounted.current) setError(null);
        return true;
      } catch (caught) {
        if (mounted.current) setError(actionErrorMessage(caught, t));
        return false;
      }
    },
    [t],
  );

  return { error, run };
}
