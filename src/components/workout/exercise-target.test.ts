import { catalogs, type AppLocale } from '@/i18n';
import { translate } from '@/i18n/translate';

import { targetLine } from './exercise-target';

const tFor = (locale: AppLocale) =>
  ((key: Parameters<typeof translate<typeof catalogs.en>>[2], params?: Record<string, string | number>) =>
    translate(catalogs[locale], locale, key, params)) as Parameters<typeof targetLine>[0];

const target = { sets: 3, repMin: 8, repMax: 12, targetRir: 2, restSeconds: 120 };

describe('targetLine', () => {
  it('shows RIR by default', () => {
    expect(targetLine(tFor('en'), target)).toBe('3 × 8–12 · RIR 2 · 120 s');
    expect(targetLine(tFor('en'), target, 3, true)).toBe('3 × 8–12 · RIR 2 this week · 120 s');
  });

  it('shows the target as RPE (10 − RIR) with the RPE scale', () => {
    expect(targetLine(tFor('en'), target, 3, false, 'rpe')).toBe('3 × 8–12 · RPE 8 · 120 s');
    expect(targetLine(tFor('en'), target, 3, true, 'rpe')).toBe('3 × 8–12 · RPE 8 this week · 120 s');
    expect(targetLine(tFor('pt-BR'), target, 3, true, 'rpe')).toBe('3 × 8–12 · RPE 8 nesta semana · 120 s');
  });

  it('leaves out an absent target', () => {
    expect(targetLine(tFor('en'), { sets: 3, repMin: 5, repMax: 5 }, 3, false, 'rpe')).toBe('3 × 5');
  });
});
