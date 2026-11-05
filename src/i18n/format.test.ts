import { formatDate, formatKg, formatNumber, formatPercent } from './format';

const NBSP = ' ';

describe('formatNumber', () => {
  it('uses the locale decimal and grouping separators', () => {
    expect(formatNumber(96.25, 'en')).toBe('96.25');
    expect(formatNumber(96.25, 'pt-BR')).toBe('96,25');
    expect(formatNumber(1234.5, 'en')).toBe('1,234.5');
    expect(formatNumber(1234.5, 'pt-BR')).toBe('1.234,5');
  });

  it('accepts fraction digit options', () => {
    expect(formatNumber(7, 'en', { minimumFractionDigits: 2 })).toBe('7.00');
    expect(formatNumber(7, 'pt-BR', { minimumFractionDigits: 2 })).toBe('7,00');
  });
});

describe('formatKg', () => {
  it('formats loads with one to two decimals and the kg unit (SPEC §11.1)', () => {
    expect(formatKg(96.25, 'en')).toBe(`96.25${NBSP}kg`);
    expect(formatKg(96.25, 'pt-BR')).toBe(`96,25${NBSP}kg`);
    expect(formatKg(95, 'en')).toBe(`95.0${NBSP}kg`);
    expect(formatKg(75, 'pt-BR')).toBe(`75,0${NBSP}kg`);
    expect(formatKg(0, 'en')).toBe(`0.0${NBSP}kg`);
  });

  it('groups thousands for tonnage values', () => {
    expect(formatKg(12345.5, 'en')).toBe(`12,345.5${NBSP}kg`);
    expect(formatKg(12345.5, 'pt-BR')).toBe(`12.345,5${NBSP}kg`);
  });

  it('accepts fraction digit options', () => {
    expect(formatKg(96.25, 'en', { minimumFractionDigits: 0, maximumFractionDigits: 1 })).toBe(
      `96.3${NBSP}kg`,
    );
    expect(formatKg(96, 'pt-BR', { minimumFractionDigits: 0 })).toBe(`96${NBSP}kg`);
  });
});

describe('formatPercent', () => {
  it('formats a fraction of 1RM as a percentage', () => {
    expect(formatPercent(0.75, 'en')).toBe('75%');
    expect(formatPercent(0.875, 'en')).toBe('87.5%');
    expect(formatPercent(0.875, 'pt-BR')).toBe('87,5%');
  });
});

describe('formatDate', () => {
  const date = new Date(2026, 10, 5); // 5 November 2026, local time

  it('uses a medium date by default', () => {
    expect(formatDate(date, 'en')).toBe('Nov 5, 2026');
    expect(formatDate(date, 'pt-BR')).toBe('5 de nov. de 2026');
  });

  it('accepts Intl.DateTimeFormat options', () => {
    const numeric = { day: '2-digit', month: '2-digit', year: 'numeric' } as const;
    expect(formatDate(date, 'en', numeric)).toBe('11/05/2026');
    expect(formatDate(date, 'pt-BR', numeric)).toBe('05/11/2026');
  });
});
