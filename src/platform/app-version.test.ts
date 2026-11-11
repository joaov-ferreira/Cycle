import Constants from 'expo-constants';

import pkg from '../../package.json';
import { getAppVersion } from './app-version';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: null } }));

describe('getAppVersion', () => {
  it('uses the Expo config version', () => {
    (Constants as unknown as { expoConfig: unknown }).expoConfig = { version: '9.9.9' };
    expect(getAppVersion()).toBe('9.9.9');
  });

  it('falls back to package.json', () => {
    (Constants as unknown as { expoConfig: unknown }).expoConfig = null;
    expect(getAppVersion()).toBe(pkg.version);
  });
});
