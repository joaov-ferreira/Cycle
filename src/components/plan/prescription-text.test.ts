import type { Prescription } from '@/domain/prescription';
import { catalogs, formatKg, formatNumber, translate, type AppLocale, type I18nValue } from '@/i18n';

import {
  effortText,
  groupSets,
  localText,
  prescriptionLines as lines,
  targetText,
} from './prescription-text';

/** The formatter puts a non-breaking space before `kg`; the expectations below use a plain one. */
const prescriptionLines = (...args: Parameters<typeof lines>) =>
  lines(...args).map((line) => line.replace(/\u00a0/g, ' '));

function i18n(locale: AppLocale): I18nValue {
  const catalog = catalogs[locale];
  return {
    locale,
    t: (key, params) => translate(catalog, locale, key, params),
    formatNumber: (value, options) => formatNumber(value, locale, options),
    formatKg: (value, options) => formatKg(value, locale, options),
    formatPercent: String,
    formatDate: String,
    formatTime: String,
  };
}

const set = (over: Partial<Prescription['sets'][number]> = {}) => ({
  reps: 5,
  amrap: false,
  unverified: false,
  percent: 75,
  addKg: 0,
  exactKg: 75,
  kg: 75,
  ...over,
});

const prescription = (sets: Prescription['sets'], basisKg: number | null = 100): Prescription => ({
  basisExerciseId: 'barbell-bench-press',
  basisKg,
  sets,
  source: { kind: 'scheme', schemeWeek: 1 },
  phase: 'load',
  warnings: [],
});

describe('groupSets', () => {
  it('folds consecutive identical sets only', () => {
    const a = set();
    const b = set({ reps: 3 });
    expect(groupSets([a, a, b, a]).map((g) => g.count)).toEqual([2, 1, 1]);
  });
});

describe('prescriptionLines', () => {
  it('writes sets × reps @ % → load', () => {
    expect(prescriptionLines(i18n('en'), prescription([set(), set(), set()]))).toEqual(['3×5 @ 75 % → 75 kg']);
  });

  it('shows exact → rounded when they differ, with the locale decimal separator', () => {
    const rx = prescription([set({ exactKg: 78.75, kg: 77.5 })]);
    expect(prescriptionLines(i18n('en'), rx)).toEqual(['1×5 @ 75 % → 78.75 → 77.5 kg']);
    expect(prescriptionLines(i18n('pt-BR'), rx)).toEqual(['1×5 @ 75 % → 78,75 → 77,5 kg']);
  });

  it('uses the compact percent notation for table cells', () => {
    const rx = prescription([set({ reps: 6, percent: 70, exactKg: 70, kg: 70 })]);
    expect(prescriptionLines(i18n('en'), rx, { compact: true })).toEqual(['1×6 @70 % → 70 kg']);
  });

  it('shows the added kilograms', () => {
    const plus = prescription([set({ percent: 70, addKg: 2.5, exactKg: 72.5, kg: 72.5 })]);
    expect(prescriptionLines(i18n('en'), plus)).toEqual(['1×5 @ 70 % + 2.5 kg → 72.5 kg']);
    const minus = prescription([set({ percent: 70, addKg: -5, exactKg: 65, kg: 65 })]);
    expect(prescriptionLines(i18n('en'), minus)).toEqual(['1×5 @ 70 % − 5 kg → 65 kg']);
  });

  it('marks AMRAP and unverified sets', () => {
    const rx = prescription([set({ amrap: true, unverified: true })]);
    expect(prescriptionLines(i18n('en'), rx)).toEqual(['1×5+ @ 75 % → 75 kg · AMRAP · Unverified data']);
  });

  it('gives the reason when there is no load', () => {
    const noMax = prescription([set({ exactKg: null, kg: null })], null);
    expect(prescriptionLines(i18n('en'), noMax)).toEqual(['1×5 @ 75 % → — (1RM needed)']);
    expect(prescriptionLines(i18n('pt-BR'), noMax)).toEqual(['1×5 @ 75 % → — (1RM necessário)']);
    const noPercent = prescription([set({ percent: null, exactKg: null, kg: null })]);
    expect(prescriptionLines(i18n('en'), noPercent)).toEqual(['1×5 → — (no percentage)']);
  });
});

describe('target and effort text', () => {
  it('formats ranges and effort scales', () => {
    expect(targetText(i18n('en'), 3, 8, 12)).toBe('3 × 8–12');
    expect(targetText(i18n('en'), 3, 10, 10)).toBe('3 × 10');
    expect(effortText(i18n('en'), 2, 'rir')).toBe('RIR 2');
    expect(effortText(i18n('en'), 2, 'rpe')).toBe('RPE 8');
  });
});

describe('localText', () => {
  it('prefers pt-BR only in pt-BR', () => {
    expect(localText({ en: 'Monday', 'pt-BR': 'Segunda' }, 'pt-BR')).toBe('Segunda');
    expect(localText({ en: 'Monday', 'pt-BR': 'Segunda' }, 'en')).toBe('Monday');
    expect(localText({ en: 'Monday' }, 'pt-BR')).toBe('Monday');
  });
});
