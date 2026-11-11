import { fireEvent, screen, within } from '@testing-library/react-native';

import type { Exercise } from '@/domain/exercise';
import { DAY_MS, createClock } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import { createTestStore, samplePlanContent, seedCompletedWorkout, seedPlan } from '@/test-utils/seed';

import { ExerciseDetailScreen } from './exercise-detail-screen';

const NBSP = ' ';
const BENCH = 'barbell-bench-press';

async function setup(
  options: {
    exerciseId?: string;
    language?: 'en' | 'pt-BR';
    prepare?: (ctx: Awaited<ReturnType<typeof createTestStore>>) => Promise<void>;
  } = {},
) {
  const ctx = await createTestStore({ clock: createClock() });
  await options.prepare?.(ctx);
  const callbacks = {
    onBack: jest.fn(),
    onOpenProgress: jest.fn(),
    onOpenWorkout: jest.fn(),
    onOpenExercise: jest.fn(),
  };
  await renderInApp(<ExerciseDetailScreen exerciseId={options.exerciseId ?? BENCH} {...callbacks} />, {
    store: ctx.store,
    repos: ctx.repos,
    language: options.language ?? 'en',
  });
  return { ...ctx, ...callbacks };
}

/** Bench: 40 kg × 12, 12, 11 on 2026-03-02, then 42.5 kg × 8 a week later. */
async function twoBenchWorkouts({ store, clock }: Awaited<ReturnType<typeof createTestStore>>) {
  await seedCompletedWorkout(store, { name: 'Push', logs: { [BENCH]: { weightKg: 40, reps: [12, 12, 11] } } });
  clock.advance(7 * DAY_MS);
  await seedCompletedWorkout(store, { name: 'Push', logs: { [BENCH]: { weightKg: 42.5, reps: [8] } } });
}

const zercher = {
  name: 'Zercher Squat',
  primaryMuscle: 'quads' as const,
  equipment: 'barbell' as const,
  mechanics: 'compound' as const,
  secondaryMuscles: ['glutes' as const],
};

async function withCustom(ctx: Awaited<ReturnType<typeof createTestStore>>): Promise<Exercise> {
  return ctx.store.getState().createCustomExercise(zercher);
}

async function setupCustom(language: 'en' | 'pt-BR' = 'en') {
  let created!: Exercise;
  const result = await setup({
    language,
    exerciseId: 'custom-1',
    prepare: async (ctx) => {
      created = await withCustom(ctx);
    },
  });
  return { ...result, created };
}

describe('ExerciseDetailScreen: built-in exercise', () => {
  it('shows the names and the classification in English', async () => {
    await setup();
    expect(await screen.findByRole('header', { name: 'Barbell Bench Press' })).toBeOnTheScreen();
    expect(screen.getByText('Supino reto com barra')).toBeOnTheScreen();
    expect(screen.getByText('Chest')).toBeOnTheScreen();
    expect(screen.getByText('Triceps, Shoulders')).toBeOnTheScreen();
    expect(screen.getByText('Barbell')).toBeOnTheScreen();
    expect(screen.getByText('Compound')).toBeOnTheScreen();
  });

  it('shows the names and the classification in Portuguese', async () => {
    await setup({ language: 'pt-BR' });
    expect(await screen.findByRole('header', { name: 'Supino reto com barra' })).toBeOnTheScreen();
    expect(screen.getByText('Barbell Bench Press')).toBeOnTheScreen();
    expect(screen.getByText('Peito')).toBeOnTheScreen();
    expect(screen.getByText('Tríceps, Ombros')).toBeOnTheScreen();
    expect(screen.getByText('Barra')).toBeOnTheScreen();
    expect(screen.getByText('Multiarticular')).toBeOnTheScreen();
  });

  it('offers no edit, archive or delete actions', async () => {
    await setup();
    await screen.findByRole('header', { name: 'Barbell Bench Press' });
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeOnTheScreen();
  });

  it('calls onBack', async () => {
    const { onBack } = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('opens the progress of the exercise', async () => {
    const { onOpenProgress } = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'See progress' }));
    expect(onOpenProgress).toHaveBeenCalledWith(BENCH);
  });
});

describe('ExerciseDetailScreen: load increment', () => {
  it('shows the barbell default of 2.5 kg with its hint, and no reset action', async () => {
    await setup();
    expect(await screen.findByLabelText('load increment')).toHaveTextContent(`2.5${NBSP}kg`);
    expect(
      screen.getByText('The step used when the app raises the load for this exercise.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Reset to default/ })).not.toBeOnTheScreen();
  });

  it('formats the default in Portuguese', async () => {
    await setup({ language: 'pt-BR' });
    expect(await screen.findByLabelText('incremento de carga')).toHaveTextContent(`2,5${NBSP}kg`);
  });

  it('changes the override with the stepper and saves it in the store', async () => {
    const { store } = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Increase load increment' }));
    expect(await screen.findByText(`2.75${NBSP}kg`)).toBeOnTheScreen();
    expect(store.getState().incrementOverrides[BENCH]).toBe(2.75);

    await fireEvent.press(screen.getByRole('button', { name: 'Decrease load increment' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease load increment' }));
    expect(await screen.findByText(`2.25${NBSP}kg`)).toBeOnTheScreen();
    expect(store.getState().incrementOverrides[BENCH]).toBe(2.25);
  });

  it('resets the override to the default', async () => {
    const { store } = await setup({
      prepare: ({ store: s }) => s.getState().setIncrementOverride(BENCH, 4),
    });
    expect(await screen.findByLabelText('load increment')).toHaveTextContent(`4${NBSP}kg`);
    await fireEvent.press(screen.getByRole('button', { name: `Reset to default (2.5${NBSP}kg)` }));
    expect(await screen.findByLabelText('load increment')).toHaveTextContent(`2.5${NBSP}kg`);
    expect(store.getState().incrementOverrides[BENCH]).toBeUndefined();
    expect(screen.queryByRole('button', { name: /Reset to default/ })).not.toBeOnTheScreen();
  });

  it('labels the reset action in Portuguese', async () => {
    await setup({
      language: 'pt-BR',
      prepare: ({ store: s }) => s.getState().setIncrementOverride(BENCH, 4),
    });
    expect(
      await screen.findByRole('button', { name: `Restaurar o padrão (2,5${NBSP}kg)` }),
    ).toBeOnTheScreen();
  });

  it('stops at the limits', async () => {
    await setup({
      prepare: ({ store: s }) => s.getState().setIncrementOverride(BENCH, 0.25),
    });
    await screen.findByLabelText('load increment');
    expect(screen.getByRole('button', { name: 'Decrease load increment', disabled: true })).toBeOnTheScreen();
  });
});

describe('ExerciseDetailScreen: records and history', () => {
  it('says so without records or sessions', async () => {
    await setup();
    expect(await screen.findByText('No records yet.')).toBeOnTheScreen();
    expect(screen.getByText('No sessions logged yet.')).toBeOnTheScreen();
  });

  it('shows the personal records with their dates in English', async () => {
    await setup({ prepare: twoBenchWorkouts });
    const records = within(await screen.findByTestId('exercise-records'));
    expect(records.getByText(`42.5${NBSP}kg × 8`)).toBeOnTheScreen();
    expect(records.getByText('Mar 9, 2026')).toBeOnTheScreen();
    expect(records.getByText(`e1RM ≈ 56.0${NBSP}kg (estimate)`)).toBeOnTheScreen();
    expect(records.getByText('Mar 2, 2026')).toBeOnTheScreen();
  });

  it('shows the personal records in Portuguese', async () => {
    await setup({ language: 'pt-BR', prepare: twoBenchWorkouts });
    const records = within(await screen.findByTestId('exercise-records'));
    expect(records.getByText(`42,5${NBSP}kg × 8`)).toBeOnTheScreen();
    expect(records.getByText(`1RM est. ≈ 56,0${NBSP}kg (estimativa)`)).toBeOnTheScreen();
  });

  it('lists the recent sessions newest first, grouping equal weights', async () => {
    const { onOpenWorkout } = await setup({ prepare: twoBenchWorkouts });
    const rows = await screen.findAllByRole('button', { name: /^Open workout of/ });
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Mar 9, 2026')).toBeOnTheScreen();
    expect(within(rows[0]).getByText(`42.5${NBSP}kg × 8`)).toBeOnTheScreen();
    expect(within(rows[1]).getByText('Mar 2, 2026')).toBeOnTheScreen();
    expect(within(rows[1]).getByText(`40${NBSP}kg × 12, 12, 11`)).toBeOnTheScreen();

    await fireEvent.press(rows[1]);
    expect(onOpenWorkout).toHaveBeenCalledWith(1);
  });

  it('formats the sessions in Portuguese', async () => {
    await setup({ language: 'pt-BR', prepare: twoBenchWorkouts });
    expect(await screen.findByText(`40${NBSP}kg × 12, 12, 11`)).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: /^Abrir treino de/ })).toHaveLength(2);
  });

  it('shows only the last 5 sessions', async () => {
    await setup({
      prepare: async ({ store, clock }) => {
        for (let day = 0; day < 6; day++) {
          await seedCompletedWorkout(store, { name: 'Push', logs: { [BENCH]: { weightKg: 40, reps: [10] } } });
          clock.advance(DAY_MS);
        }
      },
    });
    expect(await screen.findAllByRole('button', { name: /^Open workout of/ })).toHaveLength(5);
  });

  it('badges a deload session', async () => {
    await setup({
      prepare: async ({ store }) => {
        const plan = await seedPlan(store, samplePlanContent());
        await store.getState().startDeload(plan.id);
        await seedCompletedWorkout(store, {
          planWorkoutId: 'w-a',
          logs: { [BENCH]: { weightKg: 30, reps: [10] } },
        });
      },
    });
    expect(await screen.findByText('Deload')).toBeOnTheScreen();
  });

  it('does not list warm-up sets', async () => {
    await setup({
      prepare: async ({ store }) => {
        await store.getState().startFreeWorkout('Push');
        await store.getState().addExercise(BENCH);
        await store.getState().addSet(0);
        await store.getState().updateSet(0, 0, { weightKg: 20, reps: 10 });
        await store.getState().setSetKind(0, 0, 'warmup');
        await store.getState().toggleSetDone(0, 0);
        await store.getState().updateSet(0, 1, { weightKg: 40, reps: 8 });
        await store.getState().toggleSetDone(0, 1);
        await store.getState().finishWorkout();
      },
    });
    const rows = await screen.findAllByRole('button', { name: /^Open workout of/ });
    expect(within(rows[0]).getByText(`40${NBSP}kg × 8`)).toBeOnTheScreen();
    expect(screen.queryByText(new RegExp(`20${NBSP}kg`))).not.toBeOnTheScreen();
  });

  it('shows no weight record for a zero-load exercise logged without added weight', async () => {
    await setup({
      exerciseId: 'pull-up',
      prepare: async ({ store }) => {
        await seedCompletedWorkout(store, { name: 'Pull', logs: { 'pull-up': { weightKg: 0, reps: [8, 7] } } });
      },
    });
    await screen.findByRole('header', { name: 'Pull-Up' });
    expect(screen.queryByText(`0${NBSP}kg × 8`)).not.toBeOnTheScreen();
    expect(screen.getByText('No records yet.')).toBeOnTheScreen();
  });
});

describe('ExerciseDetailScreen: custom exercise', () => {
  it('shows edit, archive and delete actions', async () => {
    await setupCustom();
    expect(await screen.findByRole('header', { name: 'Zercher Squat' })).toBeOnTheScreen();
    expect(screen.getByText('Custom')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeOnTheScreen();
  });

  it('edits the exercise through the form with its current values', async () => {
    const { store, created } = await setupCustom();
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit' }));
    expect(await screen.findByRole('header', { name: 'Edit exercise' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Name')).toHaveDisplayValue('Zercher Squat');
    expect(screen.getByRole('button', { name: 'Quads', selected: true })).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Zercher Front Squat');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('header', { name: 'Zercher Front Squat' })).toBeOnTheScreen();
    expect(store.getState().customExercises.find((e) => e.id === created.id)?.name.en).toBe(
      'Zercher Front Squat',
    );
  });

  it('shows a validation error when editing to a duplicate name', async () => {
    const { store, created } = await setupCustom();
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit' }));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Barbell Bench Press');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('An exercise with this name already exists')).toBeOnTheScreen();
    expect(store.getState().customExercises.find((e) => e.id === created.id)?.name.en).toBe('Zercher Squat');
  });

  it('cancels editing', async () => {
    await setupCustom();
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('header', { name: 'Zercher Squat' })).toBeOnTheScreen();
  });

  it('archives and restores', async () => {
    const { store, created } = await setupCustom();
    await fireEvent.press(await screen.findByRole('button', { name: 'Archive' }));
    expect(await screen.findByRole('button', { name: 'Restore' })).toBeOnTheScreen();
    expect(screen.getByText('Archived')).toBeOnTheScreen();
    expect(store.getState().customExercises.find((e) => e.id === created.id)?.archived).toBe(true);

    await fireEvent.press(screen.getByRole('button', { name: 'Restore' }));
    expect(await screen.findByRole('button', { name: 'Archive' })).toBeOnTheScreen();
    expect(store.getState().customExercises.find((e) => e.id === created.id)?.archived).toBe(false);
  });

  it('deletes behind a confirmation', async () => {
    const { store, onBack } = await setupCustom();
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete exercise?')).toBeOnTheScreen();
    expect(store.getState().customExercises).toHaveLength(1);

    await fireEvent.press(within(dialog).getByRole('button', { name: 'Delete' }));
    await screen.findByText('Exercise not found');
    expect(store.getState().customExercises).toHaveLength(0);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('keeps the exercise when the delete is cancelled', async () => {
    const { store } = await setupCustom();
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete' }));
    await fireEvent.press(within(await screen.findByTestId('confirm-dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('confirm-dialog')).not.toBeOnTheScreen();
    expect(store.getState().customExercises).toHaveLength(1);
  });

  it('explains that an exercise used by a plan cannot be deleted', async () => {
    const { store } = await setup({
      exerciseId: 'custom-1',
      prepare: async (ctx) => {
        const exercise = await withCustom(ctx);
        await seedPlan(
          ctx.store,
          samplePlanContent({
            workouts: [
              {
                id: 'w-z',
                name: 'Z',
                exercises: [{ id: 'pe-z', exerciseId: exercise.id, sets: 3, repMin: 8, repMax: 12 }],
              },
            ],
          }),
        );
      },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete' }));
    await fireEvent.press(within(await screen.findByTestId('confirm-dialog')).getByRole('button', { name: 'Delete' }));

    expect(
      await screen.findByText(
        'This exercise is used by a plan or a workout, so it cannot be deleted. Archive it instead.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Zercher Squat' })).toBeOnTheScreen();
    expect(store.getState().customExercises.map((e) => e.id)).toEqual(['custom-1']);
  });

  it('shows the in-use explanation in Portuguese', async () => {
    await setup({
      language: 'pt-BR',
      exerciseId: 'custom-1',
      prepare: async (ctx) => {
        const exercise = await withCustom(ctx);
        await seedPlan(
          ctx.store,
          samplePlanContent({
            workouts: [
              {
                id: 'w-z',
                name: 'Z',
                exercises: [{ id: 'pe-z', exerciseId: exercise.id, sets: 3, repMin: 8, repMax: 12 }],
              },
            ],
          }),
        );
      },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Excluir' }));
    await fireEvent.press(within(await screen.findByTestId('confirm-dialog')).getByRole('button', { name: 'Excluir' }));
    expect(
      await screen.findByText(/não pode ser excluído\. Arquive-o em vez disso\.$/),
    ).toBeOnTheScreen();
  });
});

describe('ExerciseDetailScreen: unknown exercise', () => {
  it('shows a localized not-found state with a back action', async () => {
    const { onBack } = await setup({ exerciseId: 'nope', language: 'pt-BR' });
    expect(await screen.findByText('Exercício não encontrado')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
