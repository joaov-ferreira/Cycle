/** A strength route opened directly (a reload or a link on the web) has no history: Back goes to its parent. */
import * as Localization from 'expo-localization';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import type { ReactNode } from 'react';

import { appRoutes } from '@/test-utils/app-routes';
import { createTestStore, seedPlan, v1ExamplePlan } from '@/test-utils/seed';

import { AppProviders } from '../app-providers';

jest.mock('expo-localization', () => {
  const actual = jest.requireActual('expo-localization');
  return { ...actual, getLocales: jest.fn(), useLocales: jest.fn() };
});

async function open(url: string) {
  const locales = [{ languageTag: 'en-US' }] as unknown as ReturnType<typeof Localization.getLocales>;
  (Localization.getLocales as jest.Mock).mockReturnValue(locales);
  (Localization.useLocales as jest.Mock).mockReturnValue(locales);
  const { store, repos } = await createTestStore();
  const plan = await seedPlan(store, v1ExamplePlan());
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders openRepositories={() => Promise.resolve(repos)} store={store}>
      {children}
    </AppProviders>
  );
  const router = await renderRouter(appRoutes, { initialUrl: url.replace('{plan}', String(plan.id)), wrapper });
  return { router, plan };
}

describe('Back on a strength route without history', () => {
  it.each([
    ['/programs', '/more'],
    ['/programs/smolov-jr', '/programs'],
    ['/programs/smolov-jr/start', '/programs/smolov-jr'],
    ['/maxes', '/more'],
    ['/maxes/barbell-back-squat', '/maxes'],
    ['/tools/one-rep-max', '/more'],
    ['/plans/{plan}/periodization', '/plans/{plan}'],
  ])('%s goes back to %s', async (url, parent) => {
    const { router, plan } = await open(url);
    await fireEvent.press(await screen.findByRole('button', { name: 'Back' }));
    await waitFor(() => expect(router.getPathname()).toBe(parent.replace('{plan}', String(plan.id))));
  });
});
