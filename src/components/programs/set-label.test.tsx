import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { I18nProvider, type AppLocale } from '@/i18n';

import { programText, useSetLabel } from './set-label';

async function labels(locale: AppLocale) {
  const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider locale={locale}>{children}</I18nProvider>;
  const { result } = await renderHook(() => useSetLabel(), { wrapper });
  return result.current;
}

describe('useSetLabel', () => {
  it('writes sets × reps with the percent of the 1RM', async () => {
    const label = await labels('en');
    expect(label({ sets: 3, reps: 5, percent: 75 })).toBe('3 × 5 @ 75 %');
    expect(label({ sets: 1, reps: 1 })).toBe('1 × 1');
  });

  it('formats decimals with the locale', async () => {
    expect((await labels('en'))({ sets: 2, reps: 3, percent: 82.5 })).toBe('2 × 3 @ 82.5 %');
    expect((await labels('pt-BR'))({ sets: 2, reps: 3, percent: 82.5 })).toBe('2 × 3 @ 82,5 %');
  });

  it('marks AMRAP sets with a plus after the reps and the word', async () => {
    expect((await labels('en'))({ sets: 1, reps: 5, percent: 85, amrap: true })).toBe('1 × 5+ @ 85 % AMRAP');
  });

  it('adds fixed kilograms, with the sign', async () => {
    const en = await labels('en');
    expect(en({ sets: 6, reps: 6, percent: 70, add: { kind: 'kg', kg: 2.5 } })).toBe('6 × 6 @ 70 % + 2.5\u00a0kg');
    expect(en({ sets: 6, reps: 6, percent: 70, add: { kind: 'kg', kg: -5 } })).toBe('6 × 6 @ 70 % − 5.0\u00a0kg');
    expect(en({ sets: 6, reps: 6, percent: 70, add: { kind: 'kg', kg: 0 } })).toBe('6 × 6 @ 70 %');
    expect((await labels('pt-BR'))({ sets: 6, reps: 6, percent: 70, add: { kind: 'kg', kg: 2.5 } })).toBe(
      '6 × 6 @ 70 % + 2,5\u00a0kg',
    );
  });

  it('adds a parameter increment once or several times', async () => {
    const en = await labels('en');
    expect(en({ sets: 6, reps: 6, percent: 70, add: { kind: 'param', label: 'Weekly increment', times: 1 } })).toBe(
      '6 × 6 @ 70 % + Weekly increment',
    );
    expect(en({ sets: 6, reps: 6, percent: 70, add: { kind: 'param', label: 'Weekly increment', times: 2 } })).toBe(
      '6 × 6 @ 70 % + 2 × Weekly increment',
    );
  });
});

describe('programText', () => {
  it('shows pt-BR when present and the locale is pt-BR, else English', () => {
    expect(programText({ en: 'Monday', 'pt-BR': 'Segunda-feira' }, 'pt-BR')).toBe('Segunda-feira');
    expect(programText({ en: 'Monday', 'pt-BR': 'Segunda-feira' }, 'en')).toBe('Monday');
    expect(programText({ en: 'Test' }, 'pt-BR')).toBe('Test');
  });
});
