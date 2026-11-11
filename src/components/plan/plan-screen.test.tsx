import { fireEvent, screen } from '@testing-library/react-native';

import { createClock } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import { createTestStore, samplePlanContent, seedPlan } from '@/test-utils/seed';

import { PlanScreen } from './plan-screen';

async function setup(options: { plan?: 'active' | 'archived' | 'none'; language?: 'en' | 'pt-BR' } = {}) {
  const { store, repos } = await createTestStore({ clock: createClock() });
  if (options.plan === 'active') await seedPlan(store);
  if (options.plan === 'archived') {
    const created = await seedPlan(store, samplePlanContent({ name: 'Old plan' }));
    await store.getState().activatePlan(null);
    await store.getState().setPlanArchived(created.id, true);
  }
  const callbacks = {
    onNewPlan: jest.fn(),
    onOpenPlans: jest.fn(),
    onEditPlan: jest.fn(),
    onExportPlan: jest.fn(),
  };
  await renderInApp(<PlanScreen {...callbacks} />, { store, repos, language: options.language });
  return { store, ...callbacks };
}

describe('PlanScreen', () => {
  it('shows the active plan in full with the cycle card and the workouts', async () => {
    const { store, onEditPlan, onExportPlan, onOpenPlans, onNewPlan } = await setup({ plan: 'active' });
    expect(await screen.findByText('Sample plan')).toBeOnTheScreen();
    expect(screen.getByText('Cycle 1 · Load week 1 of 2')).toBeOnTheScreen();
    expect(screen.getByTestId('plan-workout-w-a')).toBeOnTheScreen();

    const id = store.getState().plans[0].id;
    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    expect(onEditPlan).toHaveBeenCalledWith(id);
    await fireEvent.press(screen.getByRole('button', { name: 'Export' }));
    expect(onExportPlan).toHaveBeenCalledWith(id);
    await fireEvent.press(screen.getByRole('button', { name: 'All plans' }));
    expect(onOpenPlans).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'New plan' }));
    expect(onNewPlan).toHaveBeenCalledTimes(1);
  });

  it('explains what a plan is when there is none', async () => {
    const { onNewPlan } = await setup({ plan: 'none' });
    expect(await screen.findByText('No active plan')).toBeOnTheScreen();
    expect(screen.getByText(/A plan is your training program/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'All plans' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'New plan' }));
    expect(onNewPlan).toHaveBeenCalledTimes(1);
  });

  it('offers "All plans" when only archived or inactive plans exist', async () => {
    const { onOpenPlans } = await setup({ plan: 'archived', language: 'pt-BR' });
    expect(await screen.findByText('Nenhuma periodização ativa')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Todas as periodizações' }));
    expect(onOpenPlans).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Nova periodização' })).toBeOnTheScreen();
  });
});
