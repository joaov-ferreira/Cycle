import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { DEFAULT_COLOR_SCHEME, palettes, type ColorScheme, type Palette } from '@/constants/theme';

export type Theme = { scheme: ColorScheme; colors: Palette };

const ThemeContext = createContext<Theme>({
  scheme: DEFAULT_COLOR_SCHEME,
  colors: palettes[DEFAULT_COLOR_SCHEME],
});

/** Provides the active color scheme (from the user's setting; dark by default). */
export function ThemeProvider({ scheme, children }: { scheme: ColorScheme; children: ReactNode }) {
  const value = useMemo(() => ({ scheme, colors: palettes[scheme] }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
