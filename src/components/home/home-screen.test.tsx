import { fireEvent, screen, within } from '@testing-library/react-native';

import type { Repositories } from '@/data/repositories';
import { DEFAULT_CYCLE } from '@/domain/cycle';
import type { LanguageSetting } from '@/i18n/locale';
import { WorkoutInProgressError } from '@/state/errors';
import type { AppStore } from '@/state/types';
import { createClock, DAY_MS, type TestClock } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import { createTestStore, samplePlanContent, seedCompletedWorkout, seedPlan } from '@/test-utils/seed';

import { HomeScreen } from './home-screen';

type Callbacks = {
  onOpenWorkout: jest.Mock;
  onOpenWorkoutDetail: jest.Mock;
  onNewPlan: jest.Mock;
  onOpenPlan: jest.Mock;
};

function callbacks(): Callbacks {
  return {
    onOpenWorkout: jest.fn(),
    onOpenWorkoutDetail: jest.fn(),
    onNewPlan: jest.fn(),
    onOpenPlan: jest.fn(),
  };
}

/** A store over in-memory repositories (no plan yet) and a clock the test can move. */
async function setup() {
  const clock: TestClock = createClock();
  const { store, repos } = await createTestStore({ clock });
  return { store, repos, clock };
}

async function renderHome(
  store: AppStore,
  repos: Repositories,
  props: Callbacks = callbacks(),
  language: LanguageSetting = 'en',
) {
  await renderInApp(<HomeScreen {...props} />, { store, repos, language });
  return props;
}

/** A plan whose load phase has stalled: two exercises with the same result over 3 sessions. */
async function seedStalledPlan(store: AppStore, clock: TestClock) {
  await seedPlan(
    store,
    samplePlanContent({
      sessionsPerWeek: 1,
      workouts: [
        {
          id: 'w',
          name: 'W',
          exercises: [
            { id: 'e1', exerciseId: 'barbell-bench-press', sets: 1, repMin: 8, repMax: 12 },
            { id: 'e2', exerciseId: 'lat-pulldown', sets: 1, repMin: 8, repMax: 12 },
          ],
        },
      ],
      cycle: { loadWeeks: 8, deloadWeeks: 1, deloadVolumeFactor: 0.5, deloadLoadFactor: 0.9 },
    }),
  );
  for (let i = 0; i < 3; i++) {
    clock.advance(DAY_MS);
    await seedCompletedWorkout(store, {
      logs: {
        'barbell-bench-press': { weightKg: 40, reps: [10] },
        'lat-pulldown': { weightKg: 30, reps: [10] },
      },
    });
  }
}

describe('HomeScreen: without a plan', () => {
  it('offers the three ways to create a plan', async () => {
    const { store, repos } = await setup();
    const props = await renderHome(store, repos);

    await fireEvent.press(await screen.findByRole('button', { name: 'Choose a template' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Import a plan' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Start from scratch' }));

    expect(props.onNewPlan.mock.calls).toEqual([['templates'], ['import'], ['scratch']]);
  });

  it('starts a free workout with the default name and opens it', async () => {
    const { store, repos } = await setup();
    const props = await renderHome(store, repos);

    await fireEvent.press(await screen.findByRole('button', { name: 'Free workout' }));

    expect(store.getState().currentWorkout).toMatchObject({ name: 'Free workout', planId: null });
    expect(props.onOpenWorkout).toHaveBeenCalledTimes(1);
  });

  it('names the free workout in Portuguese', async () => {
    const { store, repos } = await setup();
    await renderHome(store, repos, callbacks(), 'pt-BR');

    await fireEvent.press(await screen.findByRole('button', { name: 'Treino livre' }));

    expect(store.getState().currentWorkout?.name).toBe('Treino livre');
  });

  it('shows a localized error instead of crashing when the workout cannot start', async () => {
    const { store, repos } = await setup();
    store.setState({
      startFreeWorkout: () => Promise.reject(new WorkoutInProgressError()),
    });
    const props = await renderHome(store, repos);

    await fireEvent.press(await screen.findByRole('button', { name: 'Free workout' }));

    expect(await screen.findByText('Finish or discard the workout in progress first.')).toBeOnTheScreen();
    expect(props.onOpenWorkout).not.toHaveBeenCalled();
  });
});

describe('HomeScreen: next workout', () => {
  it('shows the next workout of the active plan and starts it', async () => {
    const { store, repos } = await setup();
    await seedPlan(store);
    const props = await renderHome(store, repos);

    expect(await screen.findByText('Next workout')).toBeOnTheScreen();
    expect(screen.getByText('A')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));

    expect(store.getState().currentWorkout).toMatchObject({ planId: 1, planWorkoutId: 'w-a' });
    expect(props.onOpenWorkout).toHaveBeenCalledTimes(1);
  });

  it('advances to the next workout of the plan after a session', async () => {
    const { store, repos } = await setup();
    await seedPlan(store);
    await seedCompletedWorkout(store);
    await renderHome(store, repos);

    expect(await screen.findByText('B')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    expect(store.getState().currentWorkout).toMatchObject({ planWorkoutId: 'w-b' });
  });
});

describe('HomeScreen: cycle summary', () => {
  it('shows the load week and the sessions of the training week', async () => {
    const { store, repos } = await setup();
    await seedPlan(store);
    const props = await renderHome(store, repos);

    expect(await screen.findByText('Cycle 1 · Load week 1 of 2')).toBeOnTheScreen();
    expect(screen.getByText('Sessions this week: 0/2')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Open plan' }));
    expect(props.onOpenPlan).toHaveBeenCalledTimes(1);
  });

  it('counts the sessions of the training week', async () => {
    const { store, repos } = await setup();
    await seedPlan(store);
    await seedCompletedWorkout(store);
    await renderHome(store, repos);

    expect(await screen.findByText('Sessions this week: 1/2')).toBeOnTheScreen();
    expect(screen.getByText('Cycle 1 · Load week 1 of 2')).toBeOnTheScreen();
  });

  it('moves to the next load week when the training week ends', async () => {
    const { store, repos } = await setup();
    await seedPlan(store);
    await seedCompletedWorkout(store);
    await seedCompletedWorkout(store);
    await renderHome(store, repos);

    expect(await screen.findByText('Cycle 1 · Load week 2 of 2')).toBeOnTheScreen();
    expect(screen.getByText('Sessions this week: 0/2')).toBeOnTheScreen();
  });

  it('shows the deload phase with its badge', async () => {
    const { store, repos } = await setup();
    await seedPlan(store);
    await store.getState().startDeload(1);
    await renderHome(store, repos);

    expect(await screen.findByText('Cycle 1 · Deload week 1 of 1')).toBeOnTheScreen();
    expect(screen.getByText('Deload')).toBeOnTheScreen();
  });

  it('shows one deload week for a manual deload on a plan without deload weeks', async () => {
    const { store, repos } = await setup();
    await seedPlan(store, samplePlanContent({ cycle: { ...DEFAULT_CYCLE, loadWeeks: 2, deloadWeeks: 0 } }));
    await store.getState().startDeload(1);
    await renderHome(store, repos);

    expect(await screen.findByText('Cycle 1 · Deload week 1 of 1')).toBeOnTheScreen();
  });

  it('shows no Deload badge during the load phase', async () => {
    const { store, repos } = await setup();
    await seedPlan(store);
    await renderHome(store, repos);

    expect(await screen.findByText('Cycle 1 · Load week 1 of 2')).toBeOnTheScreen();
    expect(screen.queryByText('Deload')).toBeNull();
  });
});

describe('HomeScreen: deload advice', () => {
  it('announces an upcoming deload without actions', async () => {
    const { store, repos } = await setup();
    await seedPlan(
      store,
      samplePlanContent({ sessionsPerWeek: 1, cycle: { ...DEFAULT_CYCLE, loadWeeks: 1, deloadWeeks: 1 } }),
    );
    await renderHome(store, repos);

    expect(await screen.findByText('Deload starts after this week.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Start deload now' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });

  it('suggests an early deload naming the stalled exercises and starts it on request', async () => {
    const { store, repos, clock } = await setup();
    await seedStalledPlan(store, clock);
    await renderHome(store, repos);

    expect(await screen.findByText('Progress has stalled on 2 exercises. A deload may help.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Start deload now' }));

    expect(store.getState().plans[0].cycleState.phase).toBe('deload');
    expect(await screen.findByText('Deload week: fewer sets and lighter loads.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Start deload now' })).toBeNull();
  });

  it('dismisses the early suggestion', async () => {
    const { store, repos, clock } = await setup();
    await seedStalledPlan(store, clock);
    await renderHome(store, repos);

    await fireEvent.press(await screen.findByRole('button', { name: 'Dismiss' }));

    expect(store.getState().deloadAdviceDismissed).toBe(true);
    expect(screen.queryByText('Progress has stalled on 2 exercises. A deload may help.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });

  it('ends a deload after confirming and starts the next cycle', async () => {
    const { store, repos } = await setup();
    await seedPlan(store);
    await store.getState().startDeload(1);
    await renderHome(store, repos);

    await fireEvent.press(await screen.findByRole('button', { name: 'End deload' }));
    const dialog = screen.getByTestId('confirm-dialog');
    expect(within(dialog).getByText('End deload?')).toBeOnTheScreen();
    await fireEvent.press(within(dialog).getByRole('button', { name: 'End deload' }));

    expect(await screen.findByText('Cycle 2 · Load week 1 of 2')).toBeOnTheScreen();
    expect(store.getState().plans[0].cycleState).toMatchObject({ cycleNumber: 2, phase: 'load' });
    expect(screen.queryByText('Deload week: fewer sets and lighter loads.')).toBeNull();
  });

  it('keeps the deload when the confirmation is cancelled', async () => {
    const { store, repos } = await setup();
    await seedPlan(store);
    await store.getState().startDeload(1);
    await renderHome(store, repos);

    await fireEvent.press(await screen.findByRole('button', { name: 'End deload' }));
    await fireEvent.press(within(screen.getByTestId('confirm-dialog')).getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Cycle 1 · Deload week 1 of 1')).toBeOnTheScreen();
    expect(store.getState().plans[0].cycleState.phase).toBe('deload');
  });
});

describe('HomeScreen: resume', () => {
  it('shows the workout in progress first and opens it', async () => {
    const { store, repos } = await setup();
    await seedPlan(store);
    await store.getState().startFreeWorkout('Legs');
    const props = await renderHome(store, repos);

    expect(await screen.findByRole('button', { name: 'Resume workout' })).toBeOnTheScreen();
    expect(screen.getByText('Legs')).toBeOnTheScreen();
    expect(screen.getByText(/^Started /)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Free workout' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Resume workout' }));
    expect(props.onOpenWorkout).toHaveBeenCalledTimes(1);
  });
});

describe('HomeScreen: recent workouts', () => {
  async function seedFourWorkouts(store: AppStore, clock: TestClock) {
    for (const name of ['First', 'Second', 'Third', 'Fourth']) {
      clock.advance(DAY_MS);
      await seedCompletedWorkout(store, {
        name,
        logs: { 'barbell-bench-press': { weightKg: 100, reps: [10, 10] } },
      });
    }
  }

  it('shows the three most recent workouts with their sets and volume', async () => {
    const { store, repos, clock } = await setup();
    await seedFourWorkouts(store, clock);
    await renderHome(store, repos);

    expect(await screen.findByText('Recent workouts')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Fourth' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Third' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Second' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'First' })).toBeNull();
    expect(screen.getAllByText('2 working sets · 2,000 kg')).toHaveLength(3);
  });

  it('formats the volume for Portuguese', async () => {
    const { store, repos, clock } = await setup();
    await seedFourWorkouts(store, clock);
    await renderHome(store, repos, callbacks(), 'pt-BR');

    expect(await screen.findByText('Treinos recentes')).toBeOnTheScreen();
    expect(screen.getAllByText('2 séries de trabalho · 2.000 kg')).toHaveLength(3);
  });

  it('opens the workout detail of the tapped workout', async () => {
    const { store, repos, clock } = await setup();
    await seedFourWorkouts(store, clock);
    const props = await renderHome(store, repos);
    const second = store.getState().workouts.find((w) => w.name === 'Second');

    await fireEvent.press(await screen.findByRole('button', { name: 'Second' }));

    expect(props.onOpenWorkoutDetail).toHaveBeenCalledWith(second?.id);
  });
});

describe('HomeScreen in Portuguese', () => {
  it('shows the cycle summary, the sessions and the early advice with pt-BR wording', async () => {
    const { store, repos, clock } = await setup();
    await seedStalledPlan(store, clock);
    await renderHome(store, repos, callbacks(), 'pt-BR');

    expect(await screen.findByText('Ciclo 1 · Semana de carga 4 de 8')).toBeOnTheScreen();
    expect(screen.getByText('Sessões nesta semana: 0/1')).toBeOnTheScreen();
    expect(screen.getByText('O progresso estagnou em 2 exercícios. Um deload pode ajudar.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Iniciar deload agora' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Dispensar' })).toBeOnTheScreen();
  });
});
