import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';

/**
 * A back action for a screen that can be the first one of a session (a reload or a link on the
 * web): goes back when there is history, else replaces the screen with its parent.
 */
export function useGoBack(parent: Href): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(parent);
  }, [router, parent]);
}
