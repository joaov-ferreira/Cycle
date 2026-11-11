import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { PlanNotFoundError } from '@/data/repositories';
import type { LanguageSetting } from '@/i18n/locale';
import { createClock } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import { createTestStore, samplePlanContent, seedPlan } from '@/test-utils/seed';

import { PlanListScreen } from './plan-list-screen';

async function setup(language: LanguageSetting = 'en', extraPlans: string[] = []) {
  const { store, repos } = await createTestStore({ clock: createClock() });
  await seedPlan(store);
  for (const name of extraPlans) await seedPlan(store, samplePlanContent({ name }));
  const callbacks = { onOpenPlan: jest.fn(), onNewPlan: jest.fn(), onBack: jest.fn() };
  await renderInApp(<PlanListScreen {...callbacks} />, { store, repos, language });
  return { store, ...callbacks };
}

describe('PlanListScreen', () => {
  it('lists the non-archived plans with summary and the Active badge', async () => {
    await setup('en', ['Second plan']);
    expect(await screen.findByText('Sample plan')).toBeOnTheScreen();
    expect(screen.getByText('Second plan')).toBeOnTheScreen();
    expect(screen.getAllByText('2 workouts · 2 sessions per week')).toHaveLength(2);
    expect(screen.getAllByText('Active')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Activate Sample plan' })).toBeNull();
  });

  it('is available in Portuguese', async () => {
    await setup('pt-BR');
    expect(await screen.findByRole('header', { name: 'Periodizações' })).toBeOnTheScreen();
    expect(screen.getByText('2 treinos · 2 sessões por semana')).toBeOnTheScreen();
    expect(screen.getByText('Ativa')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Nova periodização' })).toBeOnTheScreen();
  });

  it('shows an empty state without plans', async () => {
    const { store, repos } = await createTestStore();
    await renderInApp(<PlanListScreen onOpenPlan={jest.fn()} onNewPlan={jest.fn()} />, { store, repos });
    expect(await screen.findByText('No plans yet')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('opens a plan, starts a new one and goes back', async () => {
    const { store, onOpenPlan, onNewPlan, onBack } = await setup();
    const id = store.getState().plans[0].id;
    await fireEvent.press(await screen.findByRole('button', { name: 'Open Sample plan' }));
    expect(onOpenPlan).toHaveBeenCalledWith(id);
    await fireEvent.press(screen.getByRole('button', { name: 'New plan' }));
    expect(onNewPlan).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('activates a plan', async () => {
    const { store } = await setup('en', ['Second plan']);
    await fireEvent.press(await screen.findByRole('button', { name: 'Activate Second plan' }));
    await waitFor(() => expect(store.getState().activePlanId).toBe(store.getState().plans[1].id));
    expect(await screen.findByRole('button', { name: 'Activate Sample plan' })).toBeOnTheScreen();
  });

  it.each([
    ['en' as const, 'Duplicate Sample plan', 'Sample plan (copy)'],
    ['pt-BR' as const, 'Duplicar Sample plan', 'Sample plan (cópia)'],
  ])('duplicates a plan with the localized copy name (%s)', async (language, label, copy) => {
    const { store } = await setup(language);
    await fireEvent.press(await screen.findByRole('button', { name: label }));
    await waitFor(() => expect(store.getState().plans.map((p) => p.name)).toContain(copy));
    expect(await screen.findByText(copy)).toBeOnTheScreen();
  });

  it('truncates the copy name to the 60-character limit', async () => {
    const long = 'x'.repeat(60);
    const { store } = await setup('en', [long]);
    await fireEvent.press(await screen.findByRole('button', { name: `Duplicate ${long}` }));
    await waitFor(() => expect(store.getState().plans).toHaveLength(3));
    const copy = store.getState().plans[2].name;
    expect(copy).toHaveLength(60);
    expect(copy).toBe(`${'x'.repeat(53)} (copy)`);
  });

  it('archives a plan, then lists it under "Show archived" where it can be restored', async () => {
    const { store } = await setup('en', ['Second plan']);
    await fireEvent.press(await screen.findByRole('button', { name: 'Archive Second plan' }));
    await waitFor(() => expect(store.getState().plans[1].archivedAt).not.toBeNull());
    expect(screen.queryByText('Second plan')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Show archived' }));
    expect(await screen.findByText('Second plan')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Restore Second plan' }));
    await waitFor(() => expect(store.getState().plans[1].archivedAt).toBeNull());
  });

  it('deletes a plan only after the confirmation, which says logged workouts are kept', async () => {
    const { store } = await setup('en', ['Second plan']);
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete Second plan' }));
    expect(await screen.findByText('Delete "Second plan"?')).toBeOnTheScreen();
    expect(screen.getByText(/kept in your history/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(store.getState().plans).toHaveLength(2);

    await fireEvent.press(screen.getByRole('button', { name: 'Delete Second plan' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(store.getState().plans.map((p) => p.name)).toEqual(['Sample plan']));
  });

  it('deletes an archived plan', async () => {
    const { store } = await setup('pt-BR', ['Second plan']);
    await fireEvent.press(await screen.findByRole('button', { name: 'Arquivar Second plan' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Mostrar arquivadas' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Excluir Second plan' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(store.getState().plans).toHaveLength(1));
  });

  it('shows a localized message instead of crashing when an action is rejected', async () => {
    const { store } = await setup('en', ['Second plan']);
    const id = store.getState().plans[1].id;
    await act(async () => {
      store.setState({ activatePlan: jest.fn().mockRejectedValue(new PlanNotFoundError(id)) });
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Activate Second plan' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This plan does not exist anymore.');
    await act(async () => {
      store.setState({ deletePlan: jest.fn().mockRejectedValue(new Error('boom')) });
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Delete Second plan' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeOnTheScreen();
  });
});
