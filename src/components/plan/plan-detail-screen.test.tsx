import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { suggestCycle, type Experience } from '@/domain/cycle';
import type { LanguageSetting } from '@/i18n/locale';
import type { AppStore } from '@/state';
import { createClock } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import {
  createTestStore,
  samplePlanContent,
  seedCompletedWorkout,
  seedPlan,
} from '@/test-utils/seed';

import { PlanDetailScreen } from './plan-detail-screen';

type SetupOptions = {
  language?: LanguageSetting;
  experience?: Experience;
  content?: ReturnType<typeof samplePlanContent>;
  before?: (store: AppStore) => Promise<unknown>;
  planId?: number;
};

async function setup(options: SetupOptions = {}) {
  const { store, repos } = await createTestStore({ clock: createClock() });
  await seedPlan(store, options.content);
  if (options.experience) await store.getState().setExperience(options.experience);
  await options.before?.(store);
  const planId = options.planId ?? store.getState().plans[0].id;
  const callbacks = {
    onBack: jest.fn(),
    onEditPlan: jest.fn(),
    onExportPlan: jest.fn(),
    onDeleted: jest.fn(),
    onOpenPlan: jest.fn(),
  };
  await renderInApp(<PlanDetailScreen planId={planId} {...callbacks} />, {
    store,
    repos,
    language: options.language,
  });
  return { store, planId, ...callbacks };
}

const plan = (store: AppStore) => store.getState().plans[0];

/** Logs the workout A of the sample plan, same loads and reps every time. */
const logA = (store: AppStore) =>
  seedCompletedWorkout(store, {
    planWorkoutId: 'w-a',
    logs: {
      'barbell-bench-press': { weightKg: 40, reps: [10, 10, 10] },
      'lat-pulldown': { weightKg: 30, reps: [10, 10, 10] },
    },
  });

describe('PlanDetailScreen: header and workouts', () => {
  it('shows the name, description, summary and the Active badge', async () => {
    await setup({ content: samplePlanContent({ name: 'Push pull', description: 'Twice a week' }) });
    expect(await screen.findByText('Push pull')).toBeOnTheScreen();
    expect(screen.getByText('Twice a week')).toBeOnTheScreen();
    expect(screen.getByText('2 workouts · 2 sessions per week')).toBeOnTheScreen();
    expect(screen.getByText('Active')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Activate' })).toBeNull();
  });

  it('lists the exercises with target, RIR, rest and note', async () => {
    await setup({
      content: samplePlanContent({
        workouts: [
          {
            id: 'w-a',
            name: 'A',
            exercises: [
              {
                id: 'pe-1',
                exerciseId: 'barbell-bench-press',
                sets: 4,
                repMin: 8,
                repMax: 12,
                targetRir: 2,
                restSeconds: 120,
                note: 'Pause on the chest',
              },
              { id: 'pe-2', exerciseId: 'lat-pulldown', sets: 5, repMin: 5, repMax: 5 },
            ],
          },
        ],
      }),
    });
    expect(await screen.findByText('Barbell Bench Press')).toBeOnTheScreen();
    expect(screen.getByText('4 × 8–12')).toBeOnTheScreen();
    expect(screen.getByText('RIR 2')).toBeOnTheScreen();
    expect(screen.getByText('120 s')).toBeOnTheScreen();
    expect(screen.getByText('Note: Pause on the chest')).toBeOnTheScreen();
    expect(screen.getByText('5 × 5')).toBeOnTheScreen();
    expect(screen.getAllByText('Next')).toHaveLength(1);
  });

  it('marks the suggested next workout of the active plan', async () => {
    await setup({ before: (s) => logA(s) });
    const workoutB = await screen.findByTestId('plan-workout-w-b');
    expect(within(workoutB).getByText('Next')).toBeOnTheScreen();
    expect(within(screen.getByTestId('plan-workout-w-a')).queryByText('Next')).toBeNull();
  });

  it('suggests the next load from the history, and asks to choose one without history', async () => {
    await setup({
      before: (s) =>
        seedCompletedWorkout(s, {
          planWorkoutId: 'w-a',
          logs: { 'barbell-bench-press': { weightKg: 40, reps: [12, 12, 12] } },
        }),
    });
    expect(await screen.findByText('Next: 42.5 kg')).toBeOnTheScreen();
    expect(screen.getAllByText('Next: choose a load').length).toBeGreaterThan(0);
  });

  it('formats the suggestion in Portuguese', async () => {
    await setup({
      language: 'pt-BR',
      before: (s) =>
        seedCompletedWorkout(s, {
          planWorkoutId: 'w-a',
          logs: { 'barbell-bench-press': { weightKg: 40, reps: [12, 12, 12] } },
        }),
    });
    expect(await screen.findByText('Próxima: 42,5 kg')).toBeOnTheScreen();
    expect(screen.getByText('Supino reto com barra')).toBeOnTheScreen();
    expect(screen.getByText('2 treinos · 2 sessões por semana')).toBeOnTheScreen();
    expect(screen.getByText('Treinos')).toBeOnTheScreen();
  });

  it('marks deload suggestions', async () => {
    await setup({ before: (s) => s.getState().startDeload(1) });
    await screen.findByTestId('plan-workout-w-a');
    expect(screen.getAllByText('Deload').length).toBeGreaterThan(0);
  });
});

describe('PlanDetailScreen: actions', () => {
  it('calls the navigation callbacks', async () => {
    const { planId, onBack, onEditPlan, onExportPlan } = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit' }));
    expect(onEditPlan).toHaveBeenCalledWith(planId);
    await fireEvent.press(screen.getByRole('button', { name: 'Export' }));
    expect(onExportPlan).toHaveBeenCalledWith(planId);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('duplicates the plan and opens the copy', async () => {
    const { store, onOpenPlan } = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Duplicate' }));
    await waitFor(() => expect(store.getState().plans).toHaveLength(2));
    const copy = store.getState().plans[1];
    expect(copy.name).toBe('Sample plan (copy)');
    expect(onOpenPlan).toHaveBeenCalledWith(copy.id);
  });

  it('activates an inactive plan', async () => {
    const { store } = await setup({
      before: async (s) => {
        await seedPlan(s, samplePlanContent({ name: 'Other' }));
      },
      planId: 2,
    });
    expect(store.getState().activePlanId).toBe(1);
    await fireEvent.press(await screen.findByRole('button', { name: 'Activate' }));
    await waitFor(() => expect(store.getState().activePlanId).toBe(2));
    expect(await screen.findByText('Active')).toBeOnTheScreen();
  });

  it('archives and restores the plan', async () => {
    const { store } = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(plan(store).archivedAt).not.toBeNull());
    expect(await screen.findByText('Archived')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(plan(store).archivedAt).toBeNull());
  });

  it('deletes after the confirmation and reports it', async () => {
    const { store, onDeleted } = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Delete "Sample plan"?')).toBeOnTheScreen();
    expect(store.getState().plans).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onDeleted).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await fireEvent.press(screen.getAllByRole('button', { name: 'Delete' })[1]);
    await waitFor(() => expect(store.getState().plans).toHaveLength(0));
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('shows a localized not-found state for an unknown id', async () => {
    const { onBack } = await setup({ planId: 999, language: 'pt-BR' });
    expect(await screen.findByText('Periodização não encontrada')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows a message when an action is rejected', async () => {
    const { store } = await setup();
    await act(async () => {
      store.setState({ setPlanArchived: jest.fn().mockRejectedValue(new Error('boom')) });
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Archive' }));
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeOnTheScreen();
  });
});

describe('PlanDetailScreen: cycle card', () => {
  it('shows the load status, timeline, current cell and sessions counter', async () => {
    await setup();
    expect(await screen.findByText('Cycle 1 · Load week 1 of 2')).toBeOnTheScreen();
    expect(screen.getByLabelText('Load week 1, current')).toBeOnTheScreen();
    expect(screen.getByLabelText('Load week 2')).toBeOnTheScreen();
    expect(screen.getByLabelText('Deload week 1')).toBeOnTheScreen();
    expect(screen.getByText('Sessions this week: 0/2')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Deload week 1, current')).toBeNull();
  });

  it('shows the deload status and highlights the deload cell', async () => {
    await setup({ before: (s) => s.getState().startDeload(1) });
    expect(await screen.findByText('Cycle 1 · Deload week 1 of 1')).toBeOnTheScreen();
    expect(screen.getByLabelText('Deload week 1, current')).toBeOnTheScreen();
    expect(screen.getByLabelText('Load week 1')).toBeOnTheScreen();
  });

  it('counts the sessions done this week and renders in Portuguese', async () => {
    await setup({ language: 'pt-BR', before: (s) => logA(s) });
    expect(await screen.findByText('Ciclo 1 · Semana de carga 1 de 2')).toBeOnTheScreen();
    expect(screen.getByText('Sessões nesta semana: 1/2')).toBeOnTheScreen();
    expect(screen.getByLabelText('Semana de carga 1, atual')).toBeOnTheScreen();
    expect(screen.getByLabelText('Semana de deload 1')).toBeOnTheScreen();
  });

  it('announces the upcoming deload in the last load week', async () => {
    await setup({
      before: async (s) => {
        await seedCompletedWorkout(s);
        await seedCompletedWorkout(s);
      },
    });
    expect(await screen.findByText('The deload starts after this week.')).toBeOnTheScreen();
    expect(screen.getByText('Cycle 1 · Load week 2 of 2')).toBeOnTheScreen();
  });

  it('announces the deload week', async () => {
    await setup({ before: (s) => s.getState().startDeload(1) });
    expect(await screen.findByText('Deload week: lighter sets and loads so you recover.')).toBeOnTheScreen();
  });

  it('suggests an early deload when exercises stall, and lets you dismiss it', async () => {
    const { store } = await setup({
      before: async (s) => {
        await logA(s);
        await logA(s);
        await logA(s);
      },
    });
    expect(
      await screen.findByText('Progress has stalled on 2 exercises. Consider a deload now.'),
    ).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: 'Start deload now' })).toHaveLength(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(store.getState().deloadAdviceDismissed).toBe(true));
    expect(screen.queryByText(/stalled/)).toBeNull();
  });

  it('starts the early deload from the banner', async () => {
    const { store } = await setup({
      language: 'pt-BR',
      before: async (s) => {
        await logA(s);
        await logA(s);
        await logA(s);
      },
    });
    expect(
      await screen.findByText('A evolução estagnou em 2 exercícios. Considere um deload agora.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Iniciar deload agora' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(plan(store).cycleState.phase).toBe('deload'));
  });

  it('starts a deload now only after the confirmation', async () => {
    const { store } = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Start deload now' }));
    expect(await screen.findByText('Start a deload now?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(plan(store).cycleState.phase).toBe('load');

    await fireEvent.press(screen.getByRole('button', { name: 'Start deload now' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(plan(store).cycleState).toMatchObject({ phase: 'deload', week: 1 }));
    expect(await screen.findByText('Cycle 1 · Deload week 1 of 1')).toBeOnTheScreen();
  });

  it('ends the deload and starts the next cycle', async () => {
    const { store } = await setup({ before: (s) => s.getState().startDeload(1) });
    expect(screen.queryByRole('button', { name: 'Start deload now' })).toBeNull();
    await fireEvent.press(await screen.findByRole('button', { name: 'End deload' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() =>
      expect(plan(store).cycleState).toMatchObject({ phase: 'load', cycleNumber: 2, week: 1 }),
    );
    expect(await screen.findByText('Cycle 2 · Load week 1 of 2')).toBeOnTheScreen();
  });

  it('restarts the cycle after the confirmation', async () => {
    const { store } = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Restart cycle' }));
    expect(await screen.findByText('Restart the cycle?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(plan(store).cycleState.cycleNumber).toBe(2));
  });

  it('shows no advice for an inactive plan', async () => {
    await setup({
      before: async (s) => {
        await seedPlan(s, samplePlanContent({ name: 'Other' }));
        await s.getState().startDeload(2);
      },
      planId: 2,
    });
    expect(await screen.findByText('Cycle 1 · Deload week 1 of 1')).toBeOnTheScreen();
    expect(screen.queryByTestId('deload-advice')).toBeNull();
  });
});

describe('PlanDetailScreen: cycle settings', () => {
  const open = async () => fireEvent.press(await screen.findByRole('button', { name: 'Cycle settings' }));
  const value = (label: string) => screen.getByLabelText(label);

  it('is collapsed until opened and shows the current values', async () => {
    await setup();
    expect(screen.queryByTestId('cycle-settings')).toBeNull();
    await open();
    expect(value('Load weeks')).toHaveTextContent('2');
    expect(value('Deload weeks')).toHaveTextContent('1');
    expect(value('Deload volume')).toHaveTextContent('50%');
    expect(value('Deload load')).toHaveTextContent('90%');
    expect(screen.getByText('Deload week: 50% of the sets, 90% of the load.')).toBeOnTheScreen();
  });

  it('steps the values within their bounds and saves them', async () => {
    const { store } = await setup();
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Increase Load weeks' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Increase Deload weeks' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Increase Deload weeks' }));
    expect(value('Deload weeks')).toHaveTextContent('2');
    await fireEvent.press(screen.getByRole('button', { name: 'Increase Deload volume' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease Deload load' }));
    expect(value('Deload volume')).toHaveTextContent('55%');
    expect(value('Deload load')).toHaveTextContent('85%');
    expect(screen.getByText('Deload week: 55% of the sets, 85% of the load.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(plan(store).cycle).toEqual({
        loadWeeks: 3,
        deloadWeeks: 2,
        deloadVolumeFactor: 0.55,
        deloadLoadFactor: 0.85,
      }),
    );
    expect(await screen.findByText('Cycle settings saved.')).toBeOnTheScreen();
  });

  it('keeps Save disabled until something changes', async () => {
    await setup();
    await open();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease Load weeks' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('bounds the percentages', async () => {
    await setup({
      content: samplePlanContent({
        cycle: { loadWeeks: 1, deloadWeeks: 0, deloadVolumeFactor: 0.3, deloadLoadFactor: 1 },
      }),
    });
    await open();
    expect(screen.getByRole('button', { name: 'Decrease Deload volume' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Increase Deload load' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Decrease Deload weeks' })).toBeDisabled();
    expect(screen.getByText('No scheduled deload week.')).toBeOnTheScreen();
  });

  it.each([
    ['beginner' as const, 'beginner', '8', 8],
    ['intermediate' as const, 'intermediate', '6', 6],
    ['advanced' as const, 'advanced', '4', 4],
  ])('fills the form with the %s suggestion and names the level', async (experience, level, text, weeks) => {
    const { store } = await setup({
      experience,
      content: samplePlanContent({
        cycle: { loadWeeks: 3, deloadWeeks: 2, deloadVolumeFactor: 0.8, deloadLoadFactor: 0.7 },
      }),
    });
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Suggest' }));
    expect(value('Load weeks')).toHaveTextContent(text);
    expect(value('Deload weeks')).toHaveTextContent('1');
    expect(value('Deload volume')).toHaveTextContent('50%');
    expect(value('Deload load')).toHaveTextContent('90%');
    expect(screen.getByText(`Suggested for the ${level} level.`)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(plan(store).cycle).toEqual(suggestCycle(experience)));
    expect(plan(store).cycle.loadWeeks).toBe(weeks);
  });

  it('formats percentages and names the level in Portuguese', async () => {
    await setup({ language: 'pt-BR', experience: 'advanced' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Configurações do ciclo' }));
    expect(value('Volume do deload')).toHaveTextContent('50%');
    expect(screen.getByText('Semana de deload: 50% das séries, 90% da carga.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sugerir' }));
    expect(screen.getByText('Sugestão para o nível avançado.')).toBeOnTheScreen();
    expect(value('Semanas de carga')).toHaveTextContent('4');
  });

  it('shows an error instead of crashing when saving is rejected', async () => {
    const { store } = await setup();
    await act(async () => {
      store.setState({ setCycleConfig: jest.fn().mockRejectedValue(new Error('boom')) });
    });
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Increase Load weeks' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeOnTheScreen();
  });
});
