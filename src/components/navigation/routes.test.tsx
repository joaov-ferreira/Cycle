import { Slot } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import * as Localization from 'expo-localization';
import type { ReactNode } from 'react';

import HomeRoute from '@/app/(tabs)/index';
import MoreRoute from '@/app/(tabs)/more';
import PlanTabRoute from '@/app/(tabs)/plan';
import ProgressRoute from '@/app/(tabs)/progress';
import WorkoutRoute from '@/app/(tabs)/workout';
import ExerciseDetailRoute from '@/app/exercises/[id]';
import ExercisesRoute from '@/app/exercises/index';
import ExerciseNewRoute from '@/app/exercises/new';
import HistoryDetailRoute from '@/app/history/[id]';
import HistoryRoute from '@/app/history/index';
import PlanDetailRoute from '@/app/plans/[id]/index';
import PlanEditRoute from '@/app/plans/[id]/edit';
import PlansRoute from '@/app/plans/index';
import PlanImportRoute from '@/app/plans/import';
import PlanNewRoute from '@/app/plans/new';
import PlanTemplatesRoute from '@/app/plans/templates';
import SettingsRoute from '@/app/settings';
import { createMemoryRepositories } from '@/data/memory/memory-repositories';

import { AppProviders } from '../app-providers';

jest.mock('expo-localization', () => {
  const actual = jest.requireActual('expo-localization');
  return { ...actual, getLocales: jest.fn(), useLocales: jest.fn() };
});

function setDeviceLocale(tag: string) {
  const locales = [{ languageTag: tag }] as unknown as ReturnType<typeof Localization.getLocales>;
  (Localization.getLocales as jest.Mock).mockReturnValue(locales);
  (Localization.useLocales as jest.Mock).mockReturnValue(locales);
}

const routes = {
  _layout: Slot,
  '(tabs)/index': HomeRoute,
  '(tabs)/plan': PlanTabRoute,
  '(tabs)/workout': WorkoutRoute,
  '(tabs)/progress': ProgressRoute,
  '(tabs)/more': MoreRoute,
  'plans/index': PlansRoute,
  'plans/new': PlanNewRoute,
  'plans/templates': PlanTemplatesRoute,
  'plans/import': PlanImportRoute,
  'plans/[id]/index': PlanDetailRoute,
  'plans/[id]/edit': PlanEditRoute,
  'exercises/index': ExercisesRoute,
  'exercises/new': ExerciseNewRoute,
  'exercises/[id]': ExerciseDetailRoute,
  'history/index': HistoryRoute,
  'history/[id]': HistoryDetailRoute,
  settings: SettingsRoute,
};

/** Every route of SPEC §12 with its placeholder title, in English and Portuguese. */
const CASES: [url: string, en: string, ptBR: string][] = [
  ['/', 'Home', 'Início'],
  ['/plan', 'Plan', 'Periodização'],
  ['/workout', 'Workout', 'Treino'],
  ['/progress', 'Progress', 'Progresso'],
  ['/more', 'More', 'Mais'],
  ['/plans', 'Plans', 'Periodizações'],
  ['/plans/new', 'New plan', 'Nova periodização'],
  ['/plans/templates', 'Plan templates', 'Modelos de periodização'],
  ['/plans/import', 'Import plan', 'Importar periodização'],
  ['/plans/7', 'Plan', 'Periodização'],
  ['/plans/7/edit', 'Edit plan', 'Editar periodização'],
  ['/exercises', 'Exercises', 'Exercícios'],
  ['/exercises/new', 'New exercise', 'Novo exercício'],
  ['/exercises/3', 'Exercise', 'Exercício'],
  ['/history', 'History', 'Histórico'],
  ['/history/5', 'Workout details', 'Detalhes do treino'],
  ['/settings', 'Settings', 'Configurações'],
];

async function open(url: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders openRepositories={() => Promise.resolve(createMemoryRepositories())}>{children}</AppProviders>
  );
  return renderRouter(routes, { initialUrl: url, wrapper });
}

describe('v2 routes (SPEC §12)', () => {
  it.each(CASES)('%s shows its localized title (en)', async (url, title) => {
    setDeviceLocale('en-US');
    const result = await open(url);
    expect(await screen.findByRole('header', { name: title })).toBeOnTheScreen();
    expect(result.getPathname()).toBe(url);
  });

  it.each(CASES)('%s shows its localized title (pt-BR)', async (url, _en, title) => {
    setDeviceLocale('pt-BR');
    await open(url);
    expect(await screen.findByRole('header', { name: title })).toBeOnTheScreen();
  });
});
