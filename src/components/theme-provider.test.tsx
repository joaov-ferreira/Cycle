import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { palettes } from '@/constants/theme';

import { ThemeProvider, useTheme } from './theme-provider';

describe('ThemeProvider', () => {
  it('provides the dark palette by default (even without a provider)', async () => {
    const { result } = await renderHook(() => useTheme());
    expect(result.current.scheme).toBe('dark');
    expect(result.current.colors).toEqual(palettes.dark);
  });

  it('provides the selected scheme', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ThemeProvider scheme="light">{children}</ThemeProvider>
    );
    const { result } = await renderHook(() => useTheme(), { wrapper });
    expect(result.current.scheme).toBe('light');
    expect(result.current.colors.background).toBe('#FFFFFF');
  });
});
