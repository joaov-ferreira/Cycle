import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AppProviders } from '@/components/app-providers';
import { openSqliteRepositories } from '@/data/sqlite/open-database';

SplashScreen.preventAutoHideAsync();

function hideSplash() {
  SplashScreen.hideAsync();
}

export default function RootLayout() {
  return (
    <AppProviders openRepositories={openSqliteRepositories} onReady={hideSplash}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AppProviders>
  );
}
