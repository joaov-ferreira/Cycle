import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AppProviders } from '@/components/app-providers';
import { OnboardingGate } from '@/components/onboarding/onboarding-gate';
import { openSqliteRepositories } from '@/data/sqlite/open-database';

SplashScreen.preventAutoHideAsync();

function hideSplash() {
  SplashScreen.hideAsync();
}

export default function RootLayout() {
  return (
    <AppProviders openRepositories={openSqliteRepositories} onReady={hideSplash}>
      <OnboardingGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="programs/index" />
          <Stack.Screen name="programs/[id]" />
        </Stack>
      </OnboardingGate>
    </AppProviders>
  );
}
