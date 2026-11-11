// Global Jest setup (see jest.config.js).
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

// React Native exposes its components through lazy getters: the first access loads (and, with a
// cold transform cache, compiles) the module. Touch the ones the app uses here, outside any test,
// so that cost never lands inside the first test of a file and trips its 5 s timeout on a loaded
// machine (this made exercise-select-modal.test.tsx fail intermittently).
const reactNative = require('react-native') as Record<string, unknown>;
for (const name of [
  'ActivityIndicator',
  'FlatList',
  'Modal',
  'Pressable',
  'ScrollView',
  'Share',
  'StyleSheet',
  'Text',
  'TextInput',
  'View',
  'useWindowDimensions',
]) {
  void reactNative[name];
}
