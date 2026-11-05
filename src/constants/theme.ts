/**
 * CYCLE design tokens (SPEC §11). Dark is the default scheme; light is optional in Settings.
 * Components read colors through `useTheme()` (src/components/theme-provider.tsx), never
 * hard-coded hex values.
 */
import type { TextStyle } from 'react-native';

export type ColorScheme = 'dark' | 'light';

export const DEFAULT_COLOR_SCHEME: ColorScheme = 'dark';

export type Palette = {
  /** Screen background. */
  background: string;
  /** Cards, inputs, tab bars. */
  surface: string;
  /** Elevated or selected surfaces. */
  surfaceRaised: string;
  text: string;
  textSecondary: string;
  /** Restricted use: primary action, PR highlight, selection. */
  accent: string;
  /** Accent-hue text on background/surfaces (AA 4.5:1; `accent` itself is a fill color). */
  accentText: string;
  /** Text/icons drawn on top of `accent`. */
  onAccent: string;
  border: string;
  /** Validation errors (text). */
  danger: string;
};

export const palettes: Record<ColorScheme, Palette> = {
  dark: {
    background: '#000000',
    surface: '#121212',
    surfaceRaised: '#1C1C1E',
    text: '#FFFFFF',
    textSecondary: '#A1A1AA',
    accent: '#D32F2F',
    accentText: '#FF6B6B',
    onAccent: '#FFFFFF',
    border: '#2A2A2A',
    danger: '#FF6B6B',
  },
  light: {
    background: '#FFFFFF',
    surface: '#F4F4F5',
    surfaceRaised: '#E4E4E7',
    text: '#09090B',
    textSecondary: '#52525B',
    accent: '#C62828',
    accentText: '#B71C1C',
    onAccent: '#FFFFFF',
    border: '#D4D4D8',
    danger: '#B71C1C',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
} as const;

export const layout = {
  /** Minimum touch target (SPEC §11 accessibility). */
  minTouchTarget: 44,
  /** At or above this window width the app uses the sidebar layout (SPEC §11). */
  wideBreakpoint: 900,
  maxContentWidth: 960,
  sidebarWidth: 240,
} as const;

export type TextVariant = 'title' | 'heading' | 'body' | 'label' | 'caption';

export const typography: Record<TextVariant, TextStyle> = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: 0.5 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
};

/** Tabular figures keep columns of numbers aligned (SPEC §11). */
export const tabularNumbers: TextStyle = { fontVariant: ['tabular-nums'] };
