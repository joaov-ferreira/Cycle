import { pickLocalized } from './localized';

describe('pickLocalized', () => {
  it('returns the text in the requested language', () => {
    expect(pickLocalized({ en: 'Week', 'pt-BR': 'Semana' }, 'pt-BR')).toBe('Semana');
    expect(pickLocalized({ en: 'Week', 'pt-BR': 'Semana' }, 'en')).toBe('Week');
  });

  it('falls back to English when a translation is missing or empty', () => {
    expect(pickLocalized({ en: 'Week' }, 'pt-BR')).toBe('Week');
    expect(pickLocalized({ en: 'Week', 'pt-BR': '' }, 'pt-BR')).toBe('Week');
  });
});
