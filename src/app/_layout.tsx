import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';

import { AppProviders } from '@/components/app-providers';
import { AppShell } from '@/components/navigation/app-shell';
import { OnboardingGate, type OnboardingNext } from '@/components/onboarding/onboarding-gate';
import { OnboardingNavigation } from '@/components/onboarding/onboarding-navigation';
import { openSqliteRepositories } from '@/data/sqlite/open-database';
import { getAppVersion } from '@/platform/app-version';
import { KeepAwakeWhileLogging } from '@/platform/keep-awake';
import { createLocalizedRestNotifier } from '@/platform/localized-rest-notifier';

SplashScreen.preventAutoHideAsync();

// Created once for the app's lifetime; its texts follow the language through <TextsBinder />.
const { notifier, TextsBinder } = createLocalizedRestNotifier();
const appVersion = getAppVersion();

function hideSplash() {
  SplashScreen.hideAsync();
}

export default function RootLayout() {
  // Set by the onboarding when it finishes; the navigation acts on it once the Stack is mounted.
  const [pendingNext, setPendingNext] = useState<OnboardingNext | null>(null);
  return (
    <AppProviders
      openRepositories={openSqliteRepositories}
      notifier={notifier}
      appVersion={appVersion}
      onReady={hideSplash}>
      <TextsBinder />
      <KeepAwakeWhileLogging />
      <OnboardingGate onFinish={setPendingNext}>
        <AppShell>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="plans/index" />
            <Stack.Screen name="plans/new" />
            <Stack.Screen name="plans/templates" />
            <Stack.Screen name="plans/import" />
            <Stack.Screen name="plans/[id]/index" />
            <Stack.Screen name="plans/[id]/edit" />
            <Stack.Screen name="plans/[id]/export" />
            <Stack.Screen name="plans/[id]/periodization" />
            <Stack.Screen name="exercises/index" />
            <Stack.Screen name="exercises/new" />
            <Stack.Screen name="exercises/[id]" />
            <Stack.Screen name="history/index" />
            <Stack.Screen name="history/[id]" />
            <Stack.Screen name="programs/index" />
            <Stack.Screen name="programs/[id]/index" />
            <Stack.Screen name="programs/[id]/start" />
            <Stack.Screen name="maxes/index" />
            <Stack.Screen name="maxes/[exerciseId]" />
            <Stack.Screen name="tools/one-rep-max" />
          </Stack>
        </AppShell>
        <OnboardingNavigation next={pendingNext} onDone={() => setPendingNext(null)} />
      </OnboardingGate>
    </AppProviders>
  );
}
