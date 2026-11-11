import { restoredProfileName } from './restored-name';

const en = (name: string) => `${name} (restored)`;

describe('restoredProfileName', () => {
  it('appends the localized suffix', () => {
    expect(restoredProfileName('Ana', en, ['Default'])).toBe('Ana (restored)');
    expect(restoredProfileName('Ana', (n) => `${n} (restaurado)`, [])).toBe('Ana (restaurado)');
  });

  it('makes the name unique, ignoring case', () => {
    expect(restoredProfileName('Ana', en, ['Ana (restored)'])).toBe('Ana (restored) 2');
    expect(restoredProfileName('Ana', en, ['ana (RESTORED)', 'Ana (restored) 2'])).toBe('Ana (restored) 3');
  });

  it('cuts the original name so the result has at most 40 characters', () => {
    const result = restoredProfileName('x'.repeat(60), en, []);
    expect(result).toBe(`${'x'.repeat(29)} (restored)`);
    expect(result).toHaveLength(40);
    const second = restoredProfileName('x'.repeat(60), en, [result]);
    expect(second).toBe(`${'x'.repeat(27)} (restored) 2`);
    expect(second.length).toBeLessThanOrEqual(40);
  });

  it('survives an empty original name', () => {
    expect(restoredProfileName('', en, [])).toBe(' (restored)');
  });
});
