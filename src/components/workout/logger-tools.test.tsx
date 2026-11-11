import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import type { PlanContent } from '@/domain/plan';
import { selectExerciseNote, selectSimilarExercises, type AppStore } from '@/state';
import { samplePlanContent, v3PlanContent } from '@/test-utils/seed';

import { renderWorkout, type WorkoutContext } from './workout-test-utils';

const startA = async ({ store }: { store: AppStore }) => {
  await store.getState().startPlanWorkout('w-a');
};
const card = (index: number) => within(screen.getByTestId(`exercise-card-${index}`));
const sets = (store: AppStore, exercise: number) => store.getState().currentWorkout!.exercises[exercise].sets;

/** Sample plan whose bench press rests 120 s. */
function benchRest120(): PlanContent {
  const content = samplePlanContent();
  content.workouts[0].exercises[0] = {
    ...content.workouts[0].exercises[0],
    restSeconds: 120,
  };
  return content;
}

async function logSet(exercise: number, setNumber: number, weight: string, reps = '10') {
  await fireEvent.changeText(await card(exercise).findByLabelText(`Set ${setNumber} weight`), weight);
  await fireEvent.changeText(card(exercise).getByLabelText(`Set ${setNumber} reps`), reps);
  await fireEvent.press(card(exercise).getByRole('checkbox', { name: `Set ${setNumber} done` }));
}

describe('rest timer bar', () => {
  beforeEach(() =>
    jest.useFakeTimers({
      doNotFake: ['setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask'],
    }),
  );
  afterEach(() => jest.useRealTimers());

  const setup = async (
    options: {
      planContent?: PlanContent;
      prepare?: (ctx: WorkoutContext) => Promise<void>;
    } = {},
  ) => {
    const vibrate = jest.fn();
    let clockMs = () => 0;
    const view = await renderWorkout({
      planContent: options.planContent ?? benchRest120(),
      prepare: async (ctx) => {
        clockMs = () => ctx.clock().getTime();
        await options.prepare?.(ctx);
        await startA(ctx);
      },
      screenProps: { now: () => clockMs(), vibrate },
    });
    return { ...view, vibrate };
  };
  /** Moves the store clock forward and lets the one-second interval of the bar fire. */
  const tick = async (clock: { advance: (ms: number) => void }, ms: number) => {
    clock.advance(ms);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
  };

  it('appears after marking a set done, counts down, adjusts and skips', async () => {
    const { clock } = await setup();
    expect(screen.queryByTestId('rest-timer-bar')).toBeNull();
    await logSet(0, 1, '40');
    expect(await screen.findByText('2:00')).toBeOnTheScreen();
    expect(screen.getByLabelText('Rest: 2 minutes')).toBeOnTheScreen();

    await tick(clock, 30_000);
    expect(screen.getByText('1:30')).toBeOnTheScreen();
    expect(screen.getByLabelText('Rest: 1 minute 30 seconds')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Shorten rest by 15 seconds' }));
    expect(await screen.findByText('1:15')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Extend rest by 15 seconds' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Extend rest by 15 seconds' }));
    expect(await screen.findByText('1:45')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Skip rest' }));
    await waitFor(() => expect(screen.queryByTestId('rest-timer-bar')).toBeNull());
  });

  it('shows the visible labels of the controls', async () => {
    await setup();
    await logSet(0, 1, '40');
    expect(await screen.findByText('−15 s')).toBeOnTheScreen();
    expect(screen.getByText('+15 s')).toBeOnTheScreen();
    expect(screen.getByText('Skip')).toBeOnTheScreen();
  });

  it('says "Rest over", vibrates once and clears itself a few seconds later', async () => {
    const { clock, vibrate, store } = await setup();
    await logSet(0, 1, '40');
    await screen.findByText('2:00');

    await tick(clock, 121_000);
    expect(screen.getByText('Rest over')).toBeOnTheScreen();
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith([0, 200, 100, 200]);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(vibrate).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.queryByTestId('rest-timer-bar')).toBeNull();
    expect(store.getState().restTimer).toBeNull();
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('shows the countdown label in Portuguese', async () => {
    const vibrate = jest.fn();
    await renderWorkout({
      language: 'pt-BR',
      planContent: benchRest120(),
      prepare: startA,
      screenProps: { vibrate },
    });
    await fireEvent.changeText(await card(0).findByLabelText('Carga da série 1'), '40');
    await fireEvent.changeText(card(0).getByLabelText('Repetições da série 1'), '10');
    await fireEvent.press(card(0).getByRole('checkbox', { name: 'Série 1 concluída' }));
    expect(await screen.findByText('Descanso')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Pular o descanso' })).toBeOnTheScreen();
  });

  it('does not start without a rest (default 0 and no exercise rest)', async () => {
    await setup({
      planContent: samplePlanContent(),
      prepare: async ({ store }) => {
        await store.getState().setDefaultRestSeconds(0);
      },
    });
    await logSet(0, 1, '40');
    expect(
      await card(0).findByRole('checkbox', {
        name: 'Set 1 done',
        checked: true,
      }),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('rest-timer-bar')).toBeNull();
  });

  it('starts only after the last exercise of a superset', async () => {
    await setup({ planContent: v3PlanContent() });
    await logSet(0, 1, '40');
    await waitFor(() =>
      expect(card(0).getByRole('checkbox', { name: 'Set 1 done', checked: true })).toBeOnTheScreen(),
    );
    expect(screen.queryByTestId('rest-timer-bar')).toBeNull();

    await logSet(1, 1, '30');
    expect(await screen.findByText('1:00')).toBeOnTheScreen();
  });
});

describe('plates', () => {
  it('toggles the plates of a barbell exercise only', async () => {
    await renderWorkout({ prepare: startA });
    expect(card(1).queryByRole('button', { name: 'Plates' })).toBeNull();
    expect(card(0).queryByTestId('plates-0')).toBeNull();

    await fireEvent.press(card(0).getByRole('button', { name: 'Plates' }));
    expect(await card(0).findByText('Enter a weight to see the plates')).toBeOnTheScreen();

    await fireEvent.changeText(card(0).getByLabelText('Set 1 weight'), '100');
    await fireEvent.changeText(card(0).getByLabelText('Set 2 weight'), '142.5');
    await fireEvent.changeText(card(0).getByLabelText('Set 3 weight'), '15');
    expect(await card(0).findByText(/^100\skg: 25 \+ 15 per side$/)).toBeOnTheScreen();
    expect(card(0).getByText(/^142\.5\skg: 2 × 25 \+ 10 \+ 1\.25 per side$/)).toBeOnTheScreen();
    expect(card(0).getByText(/^15\skg: below the bar weight$/)).toBeOnTheScreen();

    await fireEvent.press(card(0).getByRole('button', { name: 'Plates' }));
    expect(card(0).queryByTestId('plates-0')).toBeNull();
  });

  it('uses the profile bar and plates, with the remainder note', async () => {
    await renderWorkout({
      prepare: async ({ store }) => {
        await store.getState().setBarKg(15);
        await startA({ store });
      },
    });
    await fireEvent.press(await card(0).findByRole('button', { name: 'Plates' }));
    await fireEvent.changeText(card(0).getByLabelText('Set 1 weight'), '43');
    await fireEvent.changeText(card(0).getByLabelText('Set 2 weight'), '15');
    expect(
      await card(0).findByText(/^43\skg: 10 \+ 2\.5 \+ 1\.25 per side \(0\.5\skg cannot be loaded\)$/),
    ).toBeOnTheScreen();
    expect(card(0).getByText(/^15\skg: bar only$/)).toBeOnTheScreen();
  });

  it('lists the plates in Portuguese', async () => {
    await renderWorkout({ language: 'pt-BR', prepare: startA });
    await fireEvent.press(await card(0).findByRole('button', { name: 'Anilhas' }));
    await fireEvent.changeText(card(0).getByLabelText('Carga da série 1'), '62,5');
    expect(await card(0).findByText(/^62,5\skg: 20 \+ 1,25 de cada lado$/)).toBeOnTheScreen();
  });
});

describe('warm-up', () => {
  it('adds the warm-up ramp from the first working weight', async () => {
    const { store } = await renderWorkout({ prepare: startA });
    await fireEvent.changeText(await card(0).findByLabelText('Set 1 weight'), '40');
    await fireEvent.press(card(0).getByRole('button', { name: 'Add warm-up' }));
    await waitFor(() => expect(sets(store, 0)).toHaveLength(6));
    expect(
      sets(store, 0)
        .slice(0, 3)
        .map((s) => [s.kind, s.weightKg, s.reps]),
    ).toEqual([
      ['warmup', 20, 8],
      ['warmup', 27.5, 5],
      ['warmup', 35, 2],
    ]);
    expect(await card(0).findAllByText('W')).toHaveLength(3);
    expect(card(0).queryByText('Enter the working weight first')).toBeNull();
  });

  it('asks for the working weight first, in both languages', async () => {
    await renderWorkout({ prepare: startA });
    await fireEvent.press(await card(0).findByRole('button', { name: 'Add warm-up' }));
    expect(await card(0).findByText('Enter the working weight first')).toBeOnTheScreen();
  });

  it('asks for the working weight first in Portuguese', async () => {
    await renderWorkout({ language: 'pt-BR', prepare: startA });
    await fireEvent.press(await card(0).findByRole('button', { name: 'Adicionar aquecimento' }));
    expect(await card(0).findByText('Informe antes a carga de trabalho')).toBeOnTheScreen();
  });
});

describe('exercise note', () => {
  it('shows the persistent note every time and edits it in place', async () => {
    const { store } = await renderWorkout({
      prepare: async ({ store: s }) => {
        await s.getState().setExerciseSettingsNote('barbell-bench-press', 'Seat on position 4');
        await startA({ store: s });
      },
    });
    expect(await card(0).findByText('Seat on position 4')).toBeOnTheScreen();

    await fireEvent.press(card(0).getByRole('button', { name: 'Edit exercise note' }));
    const field = card(0).getByLabelText('Exercise note');
    expect(field).toHaveDisplayValue('Seat on position 4');
    await fireEvent.changeText(field, 'Seat on position 5');
    await waitFor(() =>
      expect(selectExerciseNote(store.getState(), 'barbell-bench-press')).toBe('Seat on position 5'),
    );

    await fireEvent.press(card(0).getByRole('button', { name: 'Done' }));
    expect(await card(0).findByText('Seat on position 5')).toBeOnTheScreen();
  });

  it('rejects a note above 200 characters with a localized message', async () => {
    const { store } = await renderWorkout({ prepare: startA });
    await fireEvent.press(await card(0).findByRole('button', { name: 'Edit exercise note' }));
    await fireEvent.changeText(card(0).getByLabelText('Exercise note'), 'x'.repeat(201));
    expect(await card(0).findByText('Use at most 200 characters')).toBeOnTheScreen();
    expect(selectExerciseNote(store.getState(), 'barbell-bench-press')).toBe('');
  });

  it('keeps the session note labeled apart', async () => {
    const { store } = await renderWorkout({
      language: 'pt-BR',
      prepare: startA,
    });
    await fireEvent.press(await card(0).findByRole('button', { name: 'Adicionar nota da sessão' }));
    await fireEvent.changeText(card(0).getByLabelText('Nota da sessão'), 'Pesado');
    await waitFor(() => expect(store.getState().currentWorkout!.exercises[0].note).toBe('Pesado'));
    expect(card(0).getByRole('button', { name: 'Editar nota do exercício' })).toBeOnTheScreen();
  });
});

describe('supersets', () => {
  it('renders a block as one card with a heading, hint and each exercise', async () => {
    await renderWorkout({ planContent: v3PlanContent(), prepare: startA });
    const block = within(await screen.findByTestId('superset-0'));
    expect(block.getByRole('header', { name: 'Superset' })).toBeOnTheScreen();
    expect(block.getByText('Do one set of each exercise, then rest')).toBeOnTheScreen();
    expect(block.getByText('Barbell Bench Press')).toBeOnTheScreen();
    expect(block.getByText('Lat Pulldown')).toBeOnTheScreen();
    expect(block.getByTestId('exercise-card-0')).toBeOnTheScreen();
    expect(block.getByTestId('exercise-card-1')).toBeOnTheScreen();
  });

  it('calls a pair a Bi-set in Portuguese', async () => {
    await renderWorkout({
      language: 'pt-BR',
      planContent: v3PlanContent(),
      prepare: startA,
    });
    expect(await screen.findByRole('header', { name: 'Bi-set' })).toBeOnTheScreen();
  });

  it('names blocks of three and four', async () => {
    const content = v3PlanContent();
    const pull = content.workouts[0].exercises[1];
    content.workouts[0].exercises = [
      content.workouts[0].exercises[0],
      pull,
      {
        ...pull,
        id: 'pe-c',
        exerciseId: 'barbell-back-squat',
        supersetGroup: 'A',
      },
      {
        ...pull,
        id: 'pe-d',
        exerciseId: 'barbell-bench-press',
        supersetGroup: 'A',
      },
    ];
    await renderWorkout({ planContent: content, prepare: startA });
    expect(await screen.findByRole('header', { name: 'Giant set' })).toBeOnTheScreen();
  });

  it('names a block of three Tri-set, and a Giant set in Portuguese', async () => {
    const content = v3PlanContent();
    const pull = content.workouts[0].exercises[1];
    content.workouts[0].exercises = [
      content.workouts[0].exercises[0],
      pull,
      {
        ...pull,
        id: 'pe-c',
        exerciseId: 'barbell-back-squat',
        supersetGroup: 'A',
      },
    ];
    await renderWorkout({ planContent: content, prepare: startA });
    expect(await screen.findByRole('header', { name: 'Tri-set' })).toBeOnTheScreen();
  });

  it('renders single exercises as plain cards', async () => {
    await renderWorkout({ prepare: startA });
    expect(await screen.findByTestId('exercise-card-0')).toBeOnTheScreen();
    expect(screen.queryByTestId('superset-0')).toBeNull();
  });
});

describe('drop sets', () => {
  it('adds a drop set of 80% after the working set, with its marker and labels', async () => {
    const { store } = await renderWorkout({ prepare: startA });
    await fireEvent.changeText(await card(0).findByLabelText('Set 1 weight'), '40');
    await fireEvent.press(card(0).getAllByRole('button', { name: 'Add drop set' })[0]);
    await waitFor(() =>
      expect(sets(store, 0).map((s) => s.kind)).toEqual(['working', 'drop', 'working', 'working']),
    );
    expect(sets(store, 0)[1].weightKg).toBe(32.5);

    expect(await card(0).findByLabelText('Drop set weight')).toHaveDisplayValue('32.5');
    expect(card(0).getByText('D')).toBeOnTheScreen();
    expect(card(0).getByRole('button', { name: 'Drop set' })).toBeOnTheScreen();
    // Drop sets do not consume a set number: the next working set is still "Set 2".
    expect(card(0).getByLabelText('Set 2 weight')).toBeOnTheScreen();
    expect(card(0).getByLabelText('Set 3 weight')).toBeOnTheScreen();
    // Only working sets offer + Drop.
    expect(card(0).getAllByRole('button', { name: 'Add drop set' })).toHaveLength(3);
  });

  it('shows the order message on the row when the working set is not done', async () => {
    const { store } = await renderWorkout({ prepare: startA });
    await fireEvent.changeText(await card(0).findByLabelText('Set 1 weight'), '40');
    await fireEvent.press(card(0).getAllByRole('button', { name: 'Add drop set' })[0]);
    await fireEvent.changeText(await card(0).findByLabelText('Drop set reps'), '8');
    await fireEvent.press(card(0).getByRole('checkbox', { name: 'Drop set done' }));
    expect(await card(0).findByText('Finish the working set before its drop set')).toBeOnTheScreen();
    expect(sets(store, 0)[1].done).toBe(false);

    await fireEvent.changeText(card(0).getByLabelText('Drop set reps'), '9');
    await waitFor(() => expect(card(0).queryByText('Finish the working set before its drop set')).toBeNull());
  });

  it('marks a drop set done once its working set is done', async () => {
    const { store } = await renderWorkout({ prepare: startA });
    await logSet(0, 1, '40', '10');
    await waitFor(() => expect(sets(store, 0)[0].done).toBe(true));
    await fireEvent.press(card(0).getAllByRole('button', { name: 'Add drop set' })[0]);
    await fireEvent.changeText(await card(0).findByLabelText('Drop set reps'), '8');
    await fireEvent.press(card(0).getByRole('checkbox', { name: 'Drop set done' }));
    await waitFor(() =>
      expect(sets(store, 0)[1]).toMatchObject({
        kind: 'drop',
        done: true,
        reps: 8,
      }),
    );
  });

  it('labels the drop set in Portuguese', async () => {
    await renderWorkout({ language: 'pt-BR', prepare: startA });
    await fireEvent.changeText(await card(0).findByLabelText('Carga da série 1'), '40');
    await fireEvent.press(card(0).getAllByRole('button', { name: 'Adicionar drop-set' })[0]);
    expect(await card(0).findByLabelText('Carga do drop-set')).toHaveDisplayValue('32,5');
  });
});

describe('replace with similar exercises', () => {
  it('offers the similar exercises first', async () => {
    const { store } = await renderWorkout({ prepare: startA });
    const similar = selectSimilarExercises(store.getState(), 'lat-pulldown');
    expect(similar.length).toBeGreaterThan(0);

    await fireEvent.press(card(1).getByRole('button', { name: 'Exercise options' }));
    await fireEvent.press(card(1).getByRole('button', { name: 'Replace exercise' }));
    expect(await screen.findByText('Suggestions')).toBeOnTheScreen();
    expect(screen.getByText(similar[0].name.en)).toBeOnTheScreen();
  });

  it('shows no suggestions when adding an exercise', async () => {
    await renderWorkout({ prepare: startA });
    await fireEvent.press(await screen.findByRole('button', { name: 'Add exercise' }));
    expect(await screen.findByText('Search exercises')).toBeOnTheScreen();
    expect(screen.queryByText('Suggestions')).toBeNull();
  });
});

describe('target and menu', () => {
  it('says "this week" when the plan has a RIR ramp', async () => {
    const content = v3PlanContent();
    content.workouts[0].exercises = content.workouts[0].exercises.map((e) => ({
      ...e,
      supersetGroup: undefined,
    }));
    await renderWorkout({ planContent: content, prepare: startA });
    expect(await card(0).findByText(/RIR 3 this week/)).toBeOnTheScreen();
  });

  it('says "nesta semana" in Portuguese', async () => {
    const content = v3PlanContent();
    await renderWorkout({
      language: 'pt-BR',
      planContent: content,
      prepare: startA,
    });
    expect(await screen.findAllByText(/RIR 3 nesta semana/)).not.toHaveLength(0);
  });

  it('keeps a plain RIR without a ramp', async () => {
    const content = samplePlanContent();
    content.workouts[0].exercises[0] = {
      ...content.workouts[0].exercises[0],
      targetRir: 2,
    };
    await renderWorkout({ planContent: content, prepare: startA });
    expect(await card(0).findByText('3 × 8–12 · RIR 2')).toBeOnTheScreen();
  });

  it('opens a video search for the exercise name in the UI language', async () => {
    const openUrl = jest.fn();
    await renderWorkout({ prepare: startA, screenProps: { openUrl } });
    await fireEvent.press(await card(0).findByRole('button', { name: 'Exercise options' }));
    await fireEvent.press(card(0).getByRole('button', { name: 'How to do it' }));
    expect(openUrl).toHaveBeenCalledWith(
      'https://www.youtube.com/results?search_query=Barbell%20Bench%20Press',
    );
  });

  it('uses the Portuguese name for the search', async () => {
    const openUrl = jest.fn();
    await renderWorkout({
      language: 'pt-BR',
      prepare: startA,
      screenProps: { openUrl },
    });
    await fireEvent.press(await card(0).findByRole('button', { name: 'Opções do exercício' }));
    await fireEvent.press(card(0).getByRole('button', { name: 'Como fazer' }));
    expect(openUrl).toHaveBeenCalledTimes(1);
    expect(openUrl.mock.calls[0][0]).toMatch(/^https:\/\/www\.youtube\.com\/results\?search_query=Supino/);
  });
});
