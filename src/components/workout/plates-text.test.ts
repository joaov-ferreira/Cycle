import { DEFAULT_PLATES_KG } from '@/domain/plates';
import { catalogs, type AppLocale } from '@/i18n';
import { formatKg, formatNumber } from '@/i18n/format';
import { translate } from '@/i18n/translate';

import { platesText } from './plates-text';

function text(
  locale: AppLocale,
  weightKg: number,
  barKg = 20,
  plates: readonly number[] = DEFAULT_PLATES_KG,
) {
  const i18n = {
    t: (key: never, params?: Record<string, string | number>) =>
      translate(catalogs[locale], locale, key, params),
    formatKg: (value: number, options?: object) => formatKg(value, locale, options),
    formatNumber: (value: number, options?: object) => formatNumber(value, locale, options),
  };
  return platesText(i18n as never, weightKg, barKg, plates).replace(/ /g, ' ');
}

describe('platesText', () => {
  it.each([
    [40, '40 kg: 10 per side', '40 kg: 10 de cada lado'],
    [100, '100 kg: 25 + 15 per side', '100 kg: 25 + 15 de cada lado'],
    [62.5, '62.5 kg: 20 + 1.25 per side', '62,5 kg: 20 + 1,25 de cada lado'],
    [142.5, '142.5 kg: 2 × 25 + 10 + 1.25 per side', '142,5 kg: 2 × 25 + 10 + 1,25 de cada lado'],
    [20, '20 kg: bar only', '20 kg: só a barra'],
    [15, '15 kg: below the bar weight', '15 kg: abaixo do peso da barra'],
    [
      43,
      '43 kg: 10 + 1.25 per side (0.5 kg cannot be loaded)',
      '43 kg: 10 + 1,25 de cada lado (não dá para montar 0,5 kg)',
    ],
  ])('%s kg', (weight, en, pt) => {
    expect(text('en', weight)).toBe(en);
    expect(text('pt-BR', weight)).toBe(pt);
  });

  it('uses the given bar weight', () => {
    expect(text('en', 25, 15)).toBe('25 kg: 5 per side');
  });
});
