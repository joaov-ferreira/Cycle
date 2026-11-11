import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as Localization from 'expo-localization';
import { Text } from 'react-native';
import type { ReactNode } from 'react';

import ProgramDetailRoute from '@/app/programs/[id]/index';
import ProgramStartRoute from '@/app/programs/[id]/start';
import ProgramsRoute from '@/app/programs/index';
import { createMemoryRepositories } from '@/data/memory/memory-repositories';

import { AppProviders } from '../app-providers';

jest.mock('expo-localization', () => {
  const actual = jest.requireActual('expo-localization');
  return { ...actual, getLocales: jest.fn(), useLocales: jest.fn() };
});

const locales = [{ languageTag: 'en-US' }] as unknown as ReturnType<typeof Localization.getLocales>;

const routes = {
  _layout: Slot,
  'programs/index': ProgramsRoute,
  'programs/[id]/index': ProgramDetailRoute,
  'programs/[id]/start': ProgramStartRoute,
  'plans/[id]/periodization': () => <Text>periodization route</Text>,
};

async function open(url: string) {
  (Localization.getLocales as jest.Mock).mockReturnValue(locales);
  (Localization.useLocales as jest.Mock).mockReturnValue(locales);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders openRepositories={() => Promise.resolve(createMemoryRepositories())}>{children}</AppProviders>
  );
  return renderRouter(routes, { initialUrl: url, wrapper });
}

describe('programs routes', () => {
  it('opens a program from the list, then the wizard, and creates the plan', async () => {
    const result = await open('/programs');
    await fireEvent.press(await screen.findByRole('button', { name: 'Open Smolov Jr.' }));
    expect(await screen.findByRole('header', { name: 'Smolov Jr.' })).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/programs/smolov-jr');

    await fireEvent.press(screen.getByRole('button', { name: 'Start this program' }));
    expect(await screen.findByRole('header', { name: 'Start Smolov Jr.' })).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/programs/smolov-jr/start');

    await fireEvent.press(screen.getByRole('button', { name: /^Lift:/ }));
    await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'back squat');
    await fireEvent.press(await screen.findByRole('button', { name: 'Barbell Back Squat' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Create plan' }));

    expect(await screen.findByText('periodization route')).toBeOnTheScreen();
    await waitFor(() => expect(result.getPathname()).toMatch(/^\/plans\/\d+\/periodization$/));
  });

  it('shows not-found for an unknown program id', async () => {
    await open('/programs/nope');
    expect(await screen.findByText('Program not found')).toBeOnTheScreen();
  });
});
