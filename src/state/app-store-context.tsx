import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';

import type { AppState, AppStore } from './app-store';

const AppStoreContext = createContext<AppStore | null>(null);

export function AppStoreProvider({ store, children }: { store: AppStore; children: ReactNode }) {
  return <AppStoreContext.Provider value={store}>{children}</AppStoreContext.Provider>;
}

/** Subscribes to a slice of the app store; re-renders only when that slice changes. */
export function useAppStore<T>(selector: (state: AppState) => T): T {
  const store = useContext(AppStoreContext);
  if (!store) throw new Error('useAppStore must be used inside <AppStoreProvider>');
  return useStore(store, selector);
}
