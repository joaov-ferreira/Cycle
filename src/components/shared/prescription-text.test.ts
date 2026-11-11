import type { PrescribedSet } from '@/domain/prescription';
import { catalogs, formatKg, formatNumber, type AppLocale } from '@/i18n';
import { translate } from '@/i18n/translate';

import { e1rmText as e1rmRaw, prescribedSetText as setTextRaw } from './prescription-text';

/** Units are separated by a non-breaking space; the tests compare with a plain one. */
const plain = (text: string | null) => (text === null ? null : text.replace(/\u00A0/g, ' '));
const prescribedSetText = (...args: Parameters<typeof setTextRaw>) => plain(setTextRaw(...args));
const e1rmText = (...args: Parameters<typeof e1rmRaw>) => plain(e1rmRaw(...args));

const set = (overrides: Partial<PrescribedSet>): PrescribedSet => ({
  reps: 5,
  amrap: false,
  unverified: false,
  percent: 75,
  addKg: 0,
  exactKg: 75,
  kg: 75,
  ...overrides,
});

function fmt(locale: AppLocale) {
  return {
    t: (key: Parameters<typeof translate<typeof catalogs.en>>[2], params?: Record<string, string | number>) =>
      translate(catalogs[locale], locale, key, params),
    formatKg: (value: number, options?: object) => formatKg(value, locale, options),
    formatNumber: (value: number, options?: object) => formatNumber(value, locale, options),
  };
}

describe('prescribedSetText', () => {
  it('shows percent and load when exact equals rounded', () => {
    expect(prescribedSetText(fmt('en'), set({}))).toBe('75% → 75 kg');
  });

  it('shows exact → rounded when they differ', () => {
    expect(prescribedSetText(fmt('en'), set({ percent: 72.5, exactKg: 74.313, kg: 75 }))).toBe(
      '72.5% → 74.31 → 75 kg',
    );
    expect(prescribedSetText(fmt('pt-BR'), set({ percent: 72.5, exactKg: 74.313, kg: 75 }))).toBe(
      '72,5% → 74,31 → 75 kg',
    );
  });

  it('shows the added kilograms', () => {
    expect(prescribedSetText(fmt('en'), set({ percent: 70, addKg: 2.5, exactKg: 72.5, kg: 72.5 }))).toBe(
      '70% +2.5 kg → 72.5 kg',
    );
    expect(prescribedSetText(fmt('en'), set({ percent: 70, addKg: -2.5, exactKg: 67.5, kg: 67.5 }))).toBe(
      '70% −2.5 kg → 67.5 kg',
    );
  });

  it('shows only the percent without a load', () => {
    expect(prescribedSetText(fmt('en'), set({ exactKg: null, kg: null }))).toBe('75%');
  });

  it('is null for a set with nothing to show', () => {
    expect(prescribedSetText(fmt('en'), set({ percent: null, addKg: 0, exactKg: null, kg: null }))).toBeNull();
  });
});

describe('e1rmText', () => {
  it('shows at most one decimal', () => {
    expect(e1rmText(fmt('en'), 96)).toBe('e1RM ≈ 96 kg');
    expect(e1rmText(fmt('en'), 92.903)).toBe('e1RM ≈ 92.9 kg');
    expect(e1rmText(fmt('pt-BR'), 92.903)).toBe('e1RM ≈ 92,9 kg');
  });
});
