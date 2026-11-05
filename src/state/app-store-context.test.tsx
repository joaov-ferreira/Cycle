import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { createMemoryRepositories } from '@/data/memory/memory-repositories';

import { createAppStore } from './app-store';
import { AppStoreProvider, useAppStore } from './app-store-context';

describe('useAppStore', () => {
  it('reads a slice of the provided store', async () => {
    const store = createAppStore(createMemoryRepositories());
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AppStoreProvider store={store}>{children}</AppStoreProvider>
    );
    const { result } = await renderHook(() => useAppStore((s) => s.status), { wrapper });
    expect(result.current).toBe('idle');
  });

  it('throws a clear error outside the provider', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useAppStore((s) => s.status))).rejects.toThrow(
      'useAppStore must be used inside <AppStoreProvider>',
    );
  });
});
