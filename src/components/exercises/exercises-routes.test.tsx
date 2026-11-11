import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import * as Localization from 'expo-localization';
import { Text } from 'react-native';
import type { ReactNode } from 'react';

import ExerciseDetailRoute from '@/app/exercises/[id]';
import ExercisesRoute from '@/app/exercises/index';
import ExerciseNewRoute from '@/app/exercises/new';
import { createMemoryRepositories } from '@/data/memory/memory-repositories';

import { AppProviders } from '../app-providers';

jest.mock('expo-localization', () => {
  const actual = jest.requireActual('expo-localization');
  return { ...actual, getLocales: jest.fn(), useLocales: jest.fn() };
});

const locales = [{ languageTag: 'en-US' }] as unknown as ReturnType<typeof Localization.getLocales>;

function Stub({ label }: { label: string }) {
  return <Text>{label}</Text>;
}

const routes = {
  _layout: Slot,
  'exercises/index': ExercisesRoute,
  'exercises/new': ExerciseNewRoute,
  'exercises/[id]': ExerciseDetailRoute,
  '(tabs)/progress': () => <Stub label="progress route" />,
  'history/[id]': () => <Stub label="history route" />,
};

async function open(url: string) {
  (Localization.getLocales as jest.Mock).mockReturnValue(locales);
  (Localization.useLocales as jest.Mock).mockReturnValue(locales);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders openRepositories={() => Promise.resolve(createMemoryRepositories())}>{children}</AppProviders>
  );
  return renderRouter(routes, { initialUrl: url, wrapper });
}

describe('exercises routes', () => {
  it('opens an exercise from the list', async () => {
    const result = await open('/exercises');
    await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'bench press');
    await fireEvent.press(await screen.findByRole('button', { name: 'Barbell Bench Press' }));
    expect(await screen.findByRole('header', { name: 'Barbell Bench Press' })).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/exercises/barbell-bench-press');
  });

  it('opens the progress tab with the exercise id', async () => {
    const result = await open('/exercises/barbell-bench-press');
    await fireEvent.press(await screen.findByRole('button', { name: 'See progress' }));
    expect(await screen.findByText('progress route')).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/progress');
    expect(result.getSearchParams()).toEqual({ exerciseId: 'barbell-bench-press' });
  });

  it('passes the searched name to the new exercise form and opens the detail after creating', async () => {
    const result = await open('/exercises');
    await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'Zercher Squat');
    await fireEvent.press(await screen.findByRole('button', { name: 'Create “Zercher Squat”' }));

    expect(await screen.findByRole('header', { name: 'New exercise' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Name')).toHaveDisplayValue('Zercher Squat');

    await fireEvent.press(screen.getByTestId('form-primary-quads'));
    await fireEvent.press(screen.getByTestId('form-equipment-barbell'));
    await fireEvent.press(screen.getByRole('button', { name: 'Create exercise' }));

    expect(await screen.findByRole('header', { name: 'Zercher Squat' })).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/exercises/custom-1');
  });
});
