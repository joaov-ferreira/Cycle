import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { DEFAULT_CYCLE } from '@/domain/cycle';
import type { LanguageSetting } from '@/i18n/locale';
import type { AppStore } from '@/state';
import { createClock } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import {
  createTestStore,
  samplePlanContent,
  seedCompletedCycle,
  seedCompletedWorkout,
  seedPlan,
  v3PlanContent,
} from '@/test-utils/seed';

import { PlanDetailScreen } from './plan-detail-screen';
import { PlanScreen } from './plan-screen';

type SetupOptions = {
  language?: LanguageSetting;
  content?: ReturnType<typeof samplePlanContent>;
  before?: (store: AppStore, clock: ReturnType<typeof createClock>) => Promise<unknown>;
};

async function setup(options: SetupOptions = {}) {
  const clock = createClock();
  const { store, repos } = await createTestStore({ clock });
  await seedPlan(store, options.content ?? v3PlanContent());
  await options.before?.(store, clock);
  const planId = store.getState().plans[0].id;
  const callbacks = {
    onBack: jest.fn(),
    onEditPlan: jest.fn(),
    onExportPlan: jest.fn(),
    onDeleted: jest.fn(),
    onReviewWithAi: jest.fn(),
    onOpenCycle: jest.fn(),
  };
  await renderInApp(<PlanDetailScreen planId={planId} {...callbacks} />, {
    store,
    repos,
    language: options.language,
  });
  return { store, planId, clock, ...callbacks };
}

const openSettings = async () => fireEvent.press(await screen.findByRole('button', { name: /Cycle settings|Configurações do ciclo/ }));
const switchRamp = (name: string, value: boolean) => fireEvent(screen.getByRole('switch', { name }), 'valueChange', value);
const storedCycle = (store: AppStore) => store.getState().plans[0].cycle;

describe('cycle settings: RIR ramp', () => {
  it('turns the ramp on with 3 → 0 and shows the week targets', async () => {
    const { store } = await setup({
      content: samplePlanContent({ cycle: { ...DEFAULT_CYCLE, loadWeeks: 6, deloadWeeks: 1 } }),
    });
    await openSettings();
    expect(screen.queryByTestId('ramp-preview')).toBeNull();
    expect(screen.getByRole('switch', { name: 'Increase effort each week' })).not.toBeChecked();

    await switchRamp('Increase effort each week', true);
    expect(screen.getByLabelText('Start RIR')).toHaveTextContent('3');
    expect(screen.getByLabelText('End RIR')).toHaveTextContent('0');
    expect(screen.getByText('RIR per week: 3, 2, 2, 1, 1, 0')).toBeOnTheScreen();
    expect(
      screen.getByText(/replaces each exercise’s own target RIR\. The deload uses the start value/),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Cycle settings saved.')).toBeOnTheScreen();
    expect(storedCycle(store).rirRamp).toEqual({ start: 3, end: 0 });
  });

  it('keeps start at or above end while the steppers move', async () => {
    await setup({ content: samplePlanContent({ cycle: { ...DEFAULT_CYCLE, loadWeeks: 4, deloadWeeks: 1 } }) });
    await openSettings();
    await switchRamp('Increase effort each week', true);
    expect(screen.getByText('RIR per week: 3, 2, 1, 0')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Increase End RIR' }));
    expect(screen.getByLabelText('End RIR')).toHaveTextContent('1');
    await fireEvent.press(screen.getByRole('button', { name: 'Increase End RIR' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Increase End RIR' }));
    expect(screen.getByLabelText('End RIR')).toHaveTextContent('3');
    await fireEvent.press(screen.getByRole('button', { name: 'Increase End RIR' }));
    // Raising the end above the start drags the start along.
    expect(screen.getByLabelText('End RIR')).toHaveTextContent('4');
    expect(screen.getByLabelText('Start RIR')).toHaveTextContent('4');

    // Lowering the start below the end drags the end down.
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease Start RIR' }));
    expect(screen.getByLabelText('Start RIR')).toHaveTextContent('3');
    expect(screen.getByLabelText('End RIR')).toHaveTextContent('3');
    expect(screen.getByText('RIR per week: 3, 3, 3, 3')).toBeOnTheScreen();
  });

  it('turning it off stores null', async () => {
    const { store } = await setup();
    expect(storedCycle(store).rirRamp).toEqual({ start: 3, end: 0 });
    await openSettings();
    expect(screen.getByRole('switch', { name: 'Increase effort each week' })).toBeChecked();
    expect(screen.getByText('RIR per week: 3, 2, 1, 0')).toBeOnTheScreen();

    await switchRamp('Increase effort each week', false);
    expect(screen.queryByTestId('ramp-preview')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Cycle settings saved.')).toBeOnTheScreen();
    expect(storedCycle(store).rirRamp).toBeNull();
  });

  it('is in Portuguese with localized numbers', async () => {
    await setup({ language: 'pt-BR' });
    await openSettings();
    expect(screen.getByRole('switch', { name: 'Aumentar o esforço a cada semana' })).toBeChecked();
    expect(screen.getByText('RIR por semana: 3, 2, 1, 0')).toBeOnTheScreen();
    expect(screen.getByLabelText('RIR inicial')).toBeOnTheScreen();
    expect(screen.getByLabelText('RIR final')).toBeOnTheScreen();
  });
});

describe('cycle timeline with a ramp', () => {
  it('shows the RIR target in each cell and in its accessible label', async () => {
    await setup();
    const timeline = await screen.findByTestId('cycle-timeline');
    expect(within(timeline).getByLabelText('Load week 1, target RIR 3, current')).toBeOnTheScreen();
    expect(within(timeline).getByLabelText('Load week 2, target RIR 2')).toBeOnTheScreen();
    expect(within(timeline).getByLabelText('Load week 4, target RIR 0')).toBeOnTheScreen();
    expect(within(timeline).getByLabelText('Deload week 1, target RIR 3')).toBeOnTheScreen();
    expect(within(timeline).getByText('L3')).toBeOnTheScreen();
    expect(within(timeline).getByText('RIR 1')).toBeOnTheScreen();
  });

  it('keeps the plain labels without a ramp', async () => {
    await setup({ content: samplePlanContent() });
    const timeline = await screen.findByTestId('cycle-timeline');
    expect(within(timeline).getByLabelText('Load week 1, current')).toBeOnTheScreen();
    expect(within(timeline).queryByText(/^RIR/)).toBeNull();
  });

  it('speaks Portuguese', async () => {
    await setup({ language: 'pt-BR' });
    const timeline = await screen.findByTestId('cycle-timeline');
    expect(within(timeline).getByLabelText('Semana de carga 3, RIR alvo 1')).toBeOnTheScreen();
  });
});

describe('plan detail: supersets and the weekly RIR', () => {
  it('groups the exercises of a superset under its heading', async () => {
    await setup();
    const group = await screen.findByTestId('plan-superset');
    expect(within(group).getByText('Superset')).toBeOnTheScreen();
    expect(within(group).getByText('Barbell Bench Press')).toBeOnTheScreen();
    expect(within(group).getByText('Lat Pulldown')).toBeOnTheScreen();
    const squatCard = screen.getByTestId('plan-workout-w-b');
    expect(within(squatCard).queryByText('Superset')).toBeNull();
  });

  it('names the groups by size in Portuguese', async () => {
    await setup({ language: 'pt-BR' });
    expect(await screen.findByText('Bi-set')).toBeOnTheScreen();
  });

  it('shows the current week RIR, which follows the ramp', async () => {
    const { store, clock } = await setup();
    expect((await screen.findAllByText('RIR 3 this week')).length).toBeGreaterThan(0);
    expect(screen.queryByText('RIR 2 this week')).toBeNull();

    // Two sessions per week: finishing both moves the plan to load week 2.
    await act(async () => {
      await seedCompletedWorkout(store);
      clock.advance(24 * 60 * 60 * 1000);
      await seedCompletedWorkout(store);
    });
    expect((await screen.findAllByText('RIR 2 this week')).length).toBeGreaterThan(0);
    expect(screen.queryByText('RIR 3 this week')).toBeNull();
  });

  it('uses the exercise RIR when there is no ramp, and speaks Portuguese', async () => {
    const base = samplePlanContent();
    await setup({
      language: 'pt-BR',
      content: {
        ...base,
        workouts: [
          { ...base.workouts[0], exercises: [{ ...base.workouts[0].exercises[0], targetRir: 2 }] },
          base.workouts[1],
        ],
      },
    });
    expect(await screen.findByText('RIR 2')).toBeOnTheScreen();
    expect(screen.queryByText(/^RIR .* nesta semana/)).toBeNull();
  });

  it('says "nesta semana" with a ramp in Portuguese', async () => {
    await setup({ language: 'pt-BR' });
    expect((await screen.findAllByText('RIR 3 nesta semana')).length).toBeGreaterThan(0);
  });
});

describe('plan detail: entry points', () => {
  it('opens the AI review of the plan', async () => {
    const { planId, onReviewWithAi } = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Review with AI' }));
    expect(onReviewWithAi).toHaveBeenCalledWith(planId);
  });

  it('shows no cycle history before any workout', async () => {
    await setup();
    await screen.findByTestId('cycle-card');
    expect(screen.queryByText('Cycle history')).toBeNull();
  });

  it('lists the cycles newest first, marks the current one and opens a report', async () => {
    const { planId, onOpenCycle } = await setup({
      content: samplePlanContent(),
      before: async (store, clock) => {
        await seedCompletedCycle(store, clock);
        await seedCompletedWorkout(store);
      },
    });
    const history = await screen.findByTestId('cycle-history');
    expect(within(history).getByText('Cycle history')).toBeOnTheScreen();
    const rows = within(history).getAllByRole('button');
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
      'Open the report of cycle 2',
      'Open the report of cycle 1',
    ]);
    expect(within(rows[0]).getByText('Current')).toBeOnTheScreen();
    expect(within(rows[1]).queryByText('Current')).toBeNull();

    await fireEvent.press(rows[1]);
    expect(onOpenCycle).toHaveBeenCalledWith(planId, 1);
    await fireEvent.press(rows[0]);
    expect(onOpenCycle).toHaveBeenLastCalledWith(planId, 2);
  });

  it('is in Portuguese', async () => {
    await setup({
      language: 'pt-BR',
      content: samplePlanContent(),
      before: async (store) => {
        await seedCompletedWorkout(store);
      },
    });
    expect(await screen.findByText('Histórico de ciclos')).toBeOnTheScreen();
    expect(screen.getByText('Ciclo 1')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Revisar com IA' })).toBeOnTheScreen();
  });
});

describe('Plan tab: entry points', () => {
  it('passes the callbacks through to the active plan', async () => {
    const clock = createClock();
    const { store, repos } = await createTestStore({ clock });
    const plan = await seedPlan(store, samplePlanContent());
    await seedCompletedWorkout(store);
    const onReviewWithAi = jest.fn();
    const onOpenCycle = jest.fn();
    await renderInApp(
      <PlanScreen
        onNewPlan={jest.fn()}
        onOpenPlans={jest.fn()}
        onEditPlan={jest.fn()}
        onExportPlan={jest.fn()}
        onReviewWithAi={onReviewWithAi}
        onOpenCycle={onOpenCycle}
      />,
      { store, repos },
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Review with AI' }));
    expect(onReviewWithAi).toHaveBeenCalledWith(plan.id);
    await fireEvent.press(screen.getByRole('button', { name: 'Open the report of cycle 1' }));
    expect(onOpenCycle).toHaveBeenCalledWith(plan.id, 1);
  });
});
