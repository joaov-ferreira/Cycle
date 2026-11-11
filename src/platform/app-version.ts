import Constants from 'expo-constants';

import pkg from '../../package.json';

/** The app version for backups: the Expo config's, falling back to `package.json`'s. */
export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? pkg.version;
}
