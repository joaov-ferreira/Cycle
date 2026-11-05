import { renderHook } from '@testing-library/react-native';
import * as Localization from 'expo-localization';

import { getDeviceLocaleTag, useDeviceLocaleTag } from './device-locale';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(),
  useLocales: jest.fn(),
}));

const mocked = Localization as jest.Mocked<typeof Localization>;

function locales(...tags: string[]) {
  return tags.map((languageTag) => ({ languageTag })) as unknown as ReturnType<
    typeof Localization.getLocales
  >;
}

describe('device locale', () => {
  it('returns the first preferred device locale tag', () => {
    mocked.getLocales.mockReturnValue(locales('pt-PT', 'en-US'));
    expect(getDeviceLocaleTag()).toBe('pt-PT');
  });

  it('returns null when the device reports no locale', () => {
    mocked.getLocales.mockReturnValue(locales());
    expect(getDeviceLocaleTag()).toBeNull();
  });

  it('exposes the device locale as a hook that follows OS changes', async () => {
    mocked.useLocales.mockReturnValue(locales('de-DE'));
    const { result } = await renderHook(() => useDeviceLocaleTag());
    expect(result.current).toBe('de-DE');
  });
});
