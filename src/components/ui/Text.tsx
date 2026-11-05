import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { tabularNumbers, typography, type Palette, type TextVariant } from '@/constants/theme';

import { useTheme } from '../theme-provider';

export type TextTone = 'primary' | 'secondary' | 'accent' | 'danger';

const TONE_COLOR: Record<TextTone, keyof Palette> = {
  primary: 'text',
  secondary: 'textSecondary',
  accent: 'accentText',
  danger: 'danger',
};

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  /** Tabular figures, for numbers shown in columns. */
  tabular?: boolean;
};

/** Themed text. Titles and headings are exposed to screen readers as headers. */
export function Text({ variant = 'body', tone = 'primary', tabular, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  const isHeader = variant === 'title' || variant === 'heading';
  return (
    <RNText
      accessibilityRole={isHeader ? 'header' : undefined}
      style={[typography[variant], { color: colors[TONE_COLOR[tone]] }, tabular && tabularNumbers, style]}
      {...rest}
    />
  );
}
