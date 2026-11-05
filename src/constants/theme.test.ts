import { DEFAULT_COLOR_SCHEME, layout, palettes, spacing } from './theme';

/** WCAG 2.x relative luminance / contrast ratio, used to audit the palette (SPEC §11: AA). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('theme tokens', () => {
  it('is dark by default', () => {
    expect(DEFAULT_COLOR_SCHEME).toBe('dark');
  });

  it('uses the SPEC §11 dark palette', () => {
    expect(palettes.dark).toMatchObject({
      background: '#000000',
      surface: '#121212',
      surfaceRaised: '#1C1C1E',
      text: '#FFFFFF',
      textSecondary: '#A1A1AA',
      accent: '#D32F2F',
      border: '#2A2A2A',
    });
  });

  it('defines the same tokens for light and dark', () => {
    expect(Object.keys(palettes.light).sort()).toEqual(Object.keys(palettes.dark).sort());
  });

  it.each(['dark', 'light'] as const)('%s palette meets WCAG AA (4.5:1) for text', (scheme) => {
    const p = palettes[scheme];
    for (const bg of [p.background, p.surface, p.surfaceRaised]) {
      expect(contrast(p.text, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.textSecondary, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.danger, bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(p.onAccent, p.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps touch targets at least 44 pt and the wide layout breakpoint at 900 px', () => {
    expect(layout.minTouchTarget).toBe(44);
    expect(layout.wideBreakpoint).toBe(900);
  });

  it('uses a 4-pt spacing scale', () => {
    expect(Object.values(spacing).every((v) => v % 4 === 0)).toBe(true);
  });
});
