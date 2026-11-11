import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { validatePlanContent, type PlanContent } from '@/domain/plan';
import { selectFindExercise } from '@/state';
import type { AppLocale } from '@/i18n';
import { renderInApp } from '@/test-utils/render-app';
import { createTestStore, samplePlanContent, seedPlan, v3PlanContent } from '@/test-utils/seed';

import { PlanEditScreen } from '../plan-edit-screen';

/** Workout A holds four exercises, the first three ids `pe-bench`, `pe-pulldown`, `pe-row`, `pe-curl`. */
function fourExercises(): PlanContent {
  const base = samplePlanContent();
  return {
    ...base,
    workouts: [
      {
        ...base.workouts[0],
        exercises: [
          ...base.workouts[0].exercises,
          { id: 'pe-row', exerciseId: 'barbell-row', sets: 3, repMin: 8, repMax: 12 },
          { id: 'pe-curl', exerciseId: 'barbell-curl', sets: 3, repMin: 8, repMax: 12 },
          { id: 'pe-ohp', exerciseId: 'overhead-press', sets: 3, repMin: 8, repMax: 12 },
        ],
      },
      base.workouts[1],
    ],
  };
}

async function setup(content: PlanContent, language: AppLocale = 'en') {
  const { store, repos, clock } = await createTestStore();
  const plan = await seedPlan(store, content);
  const onSaved = jest.fn();
  await renderInApp(<PlanEditScreen planId={plan.id} onSaved={onSaved} onCancel={jest.fn()} />, {
    store,
    repos,
    now: clock,
    language,
  });
  return { store, plan, onSaved };
}

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const groupOf = (store: Awaited<ReturnType<typeof setup>>['store'], planId: number) =>
  store
    .getState()
    .plans.find((p) => p.id === planId)!
    .workouts[0].exercises.map((e) => e.supersetGroup ?? '-')
    .join(',');

const BENCH = 'Barbell Bench Press';
const PULLDOWN = 'Lat Pulldown';

async function saveAndRead(ctx: Awaited<ReturnType<typeof setup>>) {
  await press('Save');
  await waitFor(() => expect(ctx.onSaved).toHaveBeenCalledTimes(1));
  const stored = ctx.store.getState().plans.find((p) => p.id === ctx.plan.id)!;
  expect(validatePlanContent(stored, selectFindExercise(ctx.store.getState()))).toEqual([]);
  return groupOf(ctx.store, ctx.plan.id);
}

describe('PlanEditScreen: supersets', () => {
  it('offers Link with next on every exercise of a workout but the last', async () => {
    await setup(samplePlanContent());
    expect(await screen.findByRole('button', { name: `Link ${BENCH} with the next exercise` })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: `Link ${PULLDOWN} with the next exercise` })).toBeNull();
    expect(screen.queryByRole('button', { name: /Unlink/ })).toBeNull();
    expect(screen.queryByText('Superset')).toBeNull();
  });

  it('links two exercises: a Superset heading, an Unlink action, and the same label once saved', async () => {
    const ctx = await setup(samplePlanContent());
    await press(`Link ${BENCH} with the next exercise`);
    expect(screen.getByText('Superset')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: `Link ${BENCH} with the next exercise` })).toBeNull();
    expect(screen.getByRole('button', { name: `Unlink ${PULLDOWN} from the previous exercise` })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: `Unlink ${BENCH} from the previous exercise` })).toBeNull();
    expect(await saveAndRead(ctx)).toBe('S1,S1');
  });

  it('links a third exercise into a Tri-set and unlinks the middle member', async () => {
    const ctx = await setup(fourExercises());
    await press(`Link ${BENCH} with the next exercise`);
    await press(`Link ${PULLDOWN} with the next exercise`);
    expect(screen.getByText('Tri-set')).toBeOnTheScreen();
    expect(screen.queryByText('Superset')).toBeNull();

    await press(`Unlink ${PULLDOWN} from the previous exercise`);
    expect(screen.queryByText('Tri-set')).toBeNull();
    expect(screen.getByText('Superset')).toBeOnTheScreen();
    expect(await saveAndRead(ctx)).toBe('-,S2,S2,-,-');
  });

  it('merges two groups and caps a superset at 4 exercises', async () => {
    const ctx = await setup(fourExercises());
    await press(`Link ${BENCH} with the next exercise`);
    await press('Link Barbell Row with the next exercise');
    expect(screen.getAllByText('Superset')).toHaveLength(2);

    await press(`Link ${PULLDOWN} with the next exercise`);
    expect(screen.getByText('Giant set')).toBeOnTheScreen();
    // The last exercise would make a fifth member: the action is disabled and explains why.
    const link = screen.getByRole('button', { name: 'Link Barbell Curl with the next exercise' });
    expect(link).toBeDisabled();
    expect(link.props.accessibilityHint).toBe('A superset has at most 4 exercises.');
    await fireEvent.press(link);
    expect(screen.getByText('Giant set')).toBeOnTheScreen();
    expect(await saveAndRead(ctx)).toBe('S1,S1,S1,S1,-');
  });

  it('keeps the plan valid when members are moved out of a group or removed', async () => {
    const ctx = await setup(fourExercises());
    await press(`Link ${BENCH} with the next exercise`);
    await press(`Link ${PULLDOWN} with the next exercise`);
    // Move the third member down past a plain exercise: it leaves the group.
    await press('Move Barbell Row down');
    expect(screen.getByText('Superset')).toBeOnTheScreen();
    // Remove one of the two remaining members: the label of the other is dropped.
    await press(`Remove ${PULLDOWN}`);
    expect(screen.queryByText('Superset')).toBeNull();
    expect(await saveAndRead(ctx)).toBe('-,-,-,-');
  });

  it('keeps a group intact when a member moves inside it', async () => {
    const ctx = await setup(fourExercises());
    await press(`Link ${BENCH} with the next exercise`);
    await press(`Link ${PULLDOWN} with the next exercise`);
    await press(`Move ${BENCH} down`);
    expect(screen.getByText('Tri-set')).toBeOnTheScreen();
    expect(await saveAndRead(ctx)).toBe('S1,S1,S1,-,-');
  });

  it('shows the groups of a stored plan', async () => {
    await setup(v3PlanContent());
    expect(await screen.findByText('Superset')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `Unlink ${PULLDOWN} from the previous exercise` })).toBeOnTheScreen();
  });

  it('uses the Portuguese names and buttons', async () => {
    await setup(fourExercises(), 'pt-BR');
    await press('Unir Supino reto com barra ao próximo exercício');
    expect(screen.getByText('Bi-set')).toBeOnTheScreen();
    await press('Unir Puxada alta ao próximo exercício');
    expect(screen.getByText('Tri-set')).toBeOnTheScreen();
    await press('Unir Remada curvada ao próximo exercício');
    expect(screen.getByText('Série gigante')).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: /^Separar / })).toHaveLength(3);
  });
});
