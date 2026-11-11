import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { createTestStore, seedPlan, v3PlanContent } from '@/test-utils/seed';
import { renderInApp, type RenderInAppOptions } from '@/test-utils/render-app';

import { PlanImportScreen, type PlanImportScreenProps } from './plan-import-screen';

type Setup = Partial<PlanImportScreenProps> & RenderInAppOptions;

async function renderImport(setup: Setup = {}) {
  const { language, store, repos, ...props } = setup;
  const onImported = jest.fn();
  const rendered = await renderInApp(<PlanImportScreen onImported={onImported} {...props} />, {
    language,
    store,
    repos,
  });
  return { ...rendered, onImported };
}

async function importText(text: string, label = 'Plan text', button = 'Continue') {
  await fireEvent.changeText(await screen.findByLabelText(label), text);
  await fireEvent.press(screen.getByRole('button', { name: button }));
}

const NEW_PLAN_TEXT = `# Fresh plan
cycle: 3+1
sessions: 2

## X
Barbell Bench Press | 4x6-10
Barbell Back Squat | 3x5-8`;

async function withActivePlan() {
  const { store, repos } = await createTestStore();
  const plan = await seedPlan(store, v3PlanContent({ name: 'Current plan' }));
  return { store, repos, plan };
}

describe('PlanImportScreen: update an existing plan', () => {
  it('shows the choice with an active plan; saving as new still creates a new plan', async () => {
    const { store, repos, plan } = await withActivePlan();
    const { onImported } = await renderImport({ store, repos });
    await importText(NEW_PLAN_TEXT);

    expect(await screen.findByRole('radio', { name: 'Save as a new plan' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Update “Current plan”' })).not.toBeChecked();
    expect(screen.queryByText(/workout history and the cycle position are kept/)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Save plan' }));

    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    const plans = store.getState().plans;
    expect(plans).toHaveLength(2);
    expect(plans.find((p) => p.id === plan.id)?.name).toBe('Current plan');
    expect(onImported).toHaveBeenCalledWith(expect.objectContaining({ name: 'Fresh plan' }));
  });

  it('updates the active plan in place and archives the previous version (en)', async () => {
    const { store, repos, plan } = await withActivePlan();
    const { onImported } = await renderImport({ store, repos });
    await importText(NEW_PLAN_TEXT);

    await fireEvent.press(await screen.findByRole('radio', { name: 'Update “Current plan”' }));
    expect(screen.getByRole('radio', { name: 'Update “Current plan”' })).toBeChecked();
    expect(
      screen.getByText('The workout history and the cycle position are kept, and the previous version is archived.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('switch', { name: 'Activate this plan' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Update plan' }));

    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    const state = store.getState();
    const updated = state.plans.find((p) => p.id === plan.id)!;
    expect(updated.name).toBe('Fresh plan');
    expect(updated.workouts[0].exercises.map((e) => e.exerciseId)).toEqual([
      'barbell-bench-press',
      'barbell-back-squat',
    ]);
    expect(updated.cycleState).toEqual(plan.cycleState);
    expect(state.activePlanId).toBe(plan.id);
    expect(state.plans).toHaveLength(2);
    const backup = state.plans.find((p) => p.id !== plan.id)!;
    expect(backup.archivedAt).not.toBeNull();
    expect(backup.workouts).toEqual(plan.workouts);
    expect(backup.name).toMatch(/^Current plan \(before update .+\)$/);
    expect(onImported).toHaveBeenCalledWith(expect.objectContaining({ id: plan.id, name: 'Fresh plan' }));
  });

  it('names the archived copy in Portuguese', async () => {
    const { store, repos, plan } = await withActivePlan();
    const { onImported } = await renderImport({ store, repos, language: 'pt-BR' });
    await importText(NEW_PLAN_TEXT, 'Texto da periodização', 'Continuar');

    await fireEvent.press(await screen.findByRole('radio', { name: 'Atualizar “Current plan”' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Atualizar periodização' }));

    await waitFor(() => expect(onImported).toHaveBeenCalled());
    const backup = store.getState().plans.find((p) => p.id !== plan.id)!;
    expect(backup.name).toMatch(/^Current plan \(antes da atualização .+\)$/);
  });

  it('keeps the archived name within the 60-character limit', async () => {
    const { store, repos } = await createTestStore();
    const longName = 'L'.repeat(60);
    const plan = await seedPlan(store, v3PlanContent({ name: longName }));
    const { onImported } = await renderImport({ store, repos });
    await importText(NEW_PLAN_TEXT);

    await fireEvent.press(await screen.findByRole('radio', { name: `Update “${longName}”` }));
    await fireEvent.press(screen.getByRole('button', { name: 'Update plan' }));

    await waitFor(() => expect(onImported).toHaveBeenCalled());
    const backup = store.getState().plans.find((p) => p.id !== plan.id)!;
    expect(backup.name.length).toBeLessThanOrEqual(60);
    expect(backup.name).toMatch(/^L+ \(before update .+\)$/);
  });

  it('preselects "Update plan" for the plan given by updatePlanId, even if it is not active', async () => {
    const { store, repos } = await createTestStore();
    const other = await seedPlan(store, v3PlanContent({ name: 'Other plan' }));
    await seedPlan(store, v3PlanContent({ name: 'Active plan' }), { activate: true });
    const { onImported } = await renderImport({ store, repos, updatePlanId: other.id });
    await importText(NEW_PLAN_TEXT);

    expect(await screen.findByRole('radio', { name: 'Update “Other plan”' })).toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'Update plan' }));

    await waitFor(() => expect(onImported).toHaveBeenCalled());
    expect(store.getState().plans.find((p) => p.id === other.id)?.name).toBe('Fresh plan');
  });

  it('shows no choice without any plan', async () => {
    await renderImport();
    await importText(NEW_PLAN_TEXT);

    expect(await screen.findByText('Fresh plan')).toBeOnTheScreen();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save plan' })).toBeOnTheScreen();
  });

  it('ignores an updatePlanId that does not exist and offers the active plan', async () => {
    const { store, repos } = await withActivePlan();
    await renderImport({ store, repos, updatePlanId: 999 });
    await importText(NEW_PLAN_TEXT);

    expect(await screen.findByRole('radio', { name: 'Save as a new plan' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Update “Current plan”' })).toBeOnTheScreen();
  });
});

describe('PlanImportScreen: supersets and effort ramp in the preview', () => {
  const TEXT = `# Superset plan
cycle: 4+1
rir: 3-0

## A
Barbell Bench Press | 4x8-12
+ Lat Pulldown | 4x10-12
Barbell Back Squat | 3x5-8`;

  it('groups the superset exercises under a heading and shows the ramp (en)', async () => {
    await renderImport();
    await importText(TEXT);

    expect(await screen.findByText('Effort ramp: RIR 3 → 0')).toBeOnTheScreen();
    const group = within(screen.getByTestId('import-superset'));
    expect(group.getByText('Superset')).toBeOnTheScreen();
    expect(group.getByText('Barbell Bench Press')).toBeOnTheScreen();
    expect(group.getByText('Lat Pulldown')).toBeOnTheScreen();
    expect(group.queryByText('Barbell Back Squat')).toBeNull();
    expect(screen.getAllByText('Barbell Back Squat').length).toBeGreaterThan(0);
  });

  it('uses Bi-set in Portuguese', async () => {
    await renderImport({ language: 'pt-BR' });
    await importText(TEXT, 'Texto da periodização', 'Continuar');

    expect(await screen.findByText('Rampa de esforço: RIR 3 → 0')).toBeOnTheScreen();
    expect(within(screen.getByTestId('import-superset')).getByText('Bi-set')).toBeOnTheScreen();
  });

  it('shows no ramp line and no superset without them', async () => {
    await renderImport();
    await importText(NEW_PLAN_TEXT);

    await screen.findByText('Fresh plan');
    expect(screen.queryByText(/Effort ramp/)).toBeNull();
    expect(screen.queryByTestId('import-superset')).toBeNull();
  });
});
