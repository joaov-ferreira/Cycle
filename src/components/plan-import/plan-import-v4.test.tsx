import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { selectCurrentMaxes } from '@/state';
import { BENCH, SQUAT, createTestStore, seedReferenceMax } from '@/test-utils/seed';
import { renderInApp } from '@/test-utils/render-app';

import { PlanImportScreen } from './plan-import-screen';

const NBSP = ' ';

async function renderImport(
  options: { language?: 'en' | 'pt-BR'; seed?: (store: Awaited<ReturnType<typeof createTestStore>>['store']) => Promise<unknown> } = {},
) {
  const { store, repos } = await createTestStore();
  await options.seed?.(store);
  const onImported = jest.fn();
  await renderInApp(<PlanImportScreen onImported={onImported} />, { store, repos, language: options.language });
  return { store, onImported };
}

async function importText(text: string, label = 'Plan text', button = 'Continue') {
  await fireEvent.changeText(await screen.findByLabelText(label), text);
  await fireEvent.press(screen.getByRole('button', { name: button }));
}

const PERCENT_TEXT = `# Strength base
cycle: 3+1
sessions: 2

## A
Barbell Back Squat 3x5 @75% / 3x3 @85% / 2x1 @95%, 1x1+ @95%
Barbell Bench Press 5x5 @77,5%`;

const json = (value: unknown) => JSON.stringify(value);

const base = {
  format: 'cycle-plan',
  version: 1,
  name: 'Strength base',
  cycle: { loadWeeks: 3, deloadWeeks: 0 },
};

describe('import input', () => {
  it('explains the percent line syntax next to the other hints', async () => {
    await renderImport();
    expect(await screen.findByText(/Start a line with \+ to join the previous exercise/)).toBeOnTheScreen();
    expect(screen.getByText(/Back Squat 3x5 @75% \/ 3x3 @85%/)).toBeOnTheScreen();
  });

  it('explains it in Portuguese', async () => {
    await renderImport({ language: 'pt-BR' });
    expect(await screen.findByText(/Agachamento livre 3x5 @75% \/ 3x3 @85%/)).toBeOnTheScreen();
  });

  it('shows useful messages with the line for the new text errors', async () => {
    await renderImport();
    await importText('# P\n\n## A\nBarbell Back Squat 3x5 @75% / 3x3\nBarbell Bench Press 3x5 @75% | rir 2');
    expect(await screen.findByText('Line 4: Give a percentage to every group of the line, or to none (e.g. 3x5 @75% / 3x3 @85%).')).toBeOnTheScreen();
    expect(screen.getByText('Line 5: RIR and starting load cannot be used together with a percent scheme.')).toBeOnTheScreen();
  });

  it('shows useful messages with the path for the new JSON errors', async () => {
    await renderImport();
    await importText(
      json({
        ...base,
        workouts: [
          {
            name: 'A',
            programs: [
              { program: 'nope', day: 1, roles: { lift: SQUAT } },
              { program: 'smolov-jr', day: 1, roles: { squat: SQUAT } },
              { program: 'smolov-jr', day: 1, roles: { lift: SQUAT }, params: { weeklyIncrementKg: 9, other: 1 } },
              { program: 'smolov-jr', day: 1, roles: { lift: SQUAT }, params: { weeklyIncrementKg: 3.2 } },
            ],
            exercises: [],
          },
        ],
      }),
    );
    expect(await screen.findByText('workouts[0].programs[0].program: This program does not exist in the app.')).toBeOnTheScreen();
    expect(screen.getByText('workouts[0].programs[1].roles.squat: This program has no role with this name.')).toBeOnTheScreen();
    expect(screen.getByText('workouts[0].programs[2].params.weeklyIncrementKg: This program parameter is outside its allowed range.')).toBeOnTheScreen();
    expect(screen.getByText('workouts[0].programs[2].params.other: This program has no parameter with this name.')).toBeOnTheScreen();
    expect(screen.getByText('workouts[0].programs[3].params.weeklyIncrementKg: This program parameter does not match its allowed step.')).toBeOnTheScreen();
  });
});

describe('import preview: percent schemes', () => {
  it('shows every week of a scheme as groups of sets × reps @ %', async () => {
    await renderImport();
    await importText(PERCENT_TEXT);
    expect(await screen.findByText('Week 1: 3 × 5 @ 75 %')).toBeOnTheScreen();
    expect(screen.getByText('Week 2: 3 × 3 @ 85 %')).toBeOnTheScreen();
    expect(screen.getByText('Week 3: 2 × 1 @ 95 %, 1 × 1+ @ 95 % AMRAP')).toBeOnTheScreen();
    expect(screen.getByText('Week 1: 5 × 5 @ 77.5 %')).toBeOnTheScreen();
  });

  it('formats the scheme in Portuguese', async () => {
    await renderImport({ language: 'pt-BR' });
    await importText(PERCENT_TEXT, 'Texto da periodização', 'Continuar');
    expect(await screen.findByText('Semana 1: 5 × 5 @ 77,5 %')).toBeOnTheScreen();
    expect(screen.getByText('Semana 3: 2 × 1 @ 95 %, 1 × 1+ @ 95 % AMRAP')).toBeOnTheScreen();
  });

  it('shows the basis exercise, +kg and weeks without the exercise', async () => {
    await renderImport();
    await importText(
      json({
        ...base,
        workouts: [
          {
            name: 'A',
            exercises: [
              {
                exercise: BENCH,
                percent: {
                  of: SQUAT,
                  weeks: [[{ sets: 3, reps: 5, percent: 70, addKg: 2.5 }], [], [{ sets: 2, reps: 3, addKg: -5 }]],
                },
              },
            ],
          },
        ],
      }),
    );
    expect(await screen.findByText('Percentages of the 1RM of Barbell Back Squat')).toBeOnTheScreen();
    expect(screen.getByText(`Week 1: 3 × 5 @ 70 % + 2.5${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.getByText('Week 2: not trained')).toBeOnTheScreen();
    expect(screen.getByText(`Week 3: 2 × 3 − 5.0${NBSP}kg`)).toBeOnTheScreen();
  });

  it('saves the percent plan', async () => {
    const { store, onImported } = await renderImport();
    await importText(PERCENT_TEXT);
    await fireEvent.press(await screen.findByRole('button', { name: 'Save plan' }));
    await waitFor(() => expect(onImported).toHaveBeenCalled());
    expect(store.getState().plans[0].workouts[0].exercises[0].percent?.weeks).toHaveLength(3);
  });
});

describe('import preview: program blocks and 1RMs', () => {
  const document = (extra: Record<string, unknown> = {}) =>
    json({
      ...base,
      workouts: [
        {
          name: 'A',
          programs: [{ program: 'sheiko-29', day: 1, startWeek: 2, roles: { squat: SQUAT, bench: BENCH }, accessories: true }],
          exercises: [],
        },
        {
          name: 'B',
          programs: [{ program: 'smolov-jr', day: 2, roles: { lift: SQUAT } }],
          exercises: [{ exercise: 'lat-pulldown', sets: 3, reps: '8-12' }],
        },
      ],
      ...extra,
    });

  it('shows each block as program · day → exercise, with its week and accessories', async () => {
    await renderImport();
    await importText(document());
    expect(
      await screen.findByText('Sheiko #29 · day 1 → Barbell Back Squat, Barbell Bench Press'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Starts at program week 2')).toBeOnTheScreen();
    expect(screen.getByText('With accessories')).toBeOnTheScreen();
    expect(screen.getByText('Smolov Jr. · day 2 → Barbell Back Squat')).toBeOnTheScreen();
    expect(screen.getByText('Starts at program week 1')).toBeOnTheScreen();
    expect(screen.getByText('Lat Pulldown')).toBeOnTheScreen();
  });

  it('lists the 1RMs that will be set and those that are kept', async () => {
    await renderImport({ seed: (store) => seedReferenceMax(store, BENCH, 90) });
    await importText(
      document({
        referenceMaxes: [
          { exercise: SQUAT, kg: 140 },
          { exercise: BENCH, kg: 100 },
        ],
      }),
    );
    expect(await screen.findByText('1RMs')).toBeOnTheScreen();
    expect(screen.getByText('Will be set')).toBeOnTheScreen();
    expect(screen.getByText(`Barbell Back Squat: 140.0${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.getByText('Kept: the exercise already has a 1RM')).toBeOnTheScreen();
    expect(
      screen.getByText(`Barbell Bench Press: 100.0${NBSP}kg in the file, current 90.0${NBSP}kg`),
    ).toBeOnTheScreen();
  });

  it('formats the 1RMs in Portuguese', async () => {
    await renderImport({ language: 'pt-BR' });
    await importText(document({ referenceMaxes: [{ exercise: SQUAT, kg: 140.5 }] }), 'Texto da periodização', 'Continuar');
    expect(await screen.findByText('Serão definidos')).toBeOnTheScreen();
    expect(screen.getByText(`Agachamento livre: 140,5${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.getByText('Começa na semana 2 do programa')).toBeOnTheScreen();
  });

  it('has no 1RM section when the file has no 1RMs', async () => {
    await renderImport();
    await importText(document());
    await screen.findByText('Starts at program week 2');
    expect(screen.queryByText('1RMs')).not.toBeOnTheScreen();
  });

  it('saves the 1RMs only for exercises without one', async () => {
    const { store, onImported } = await renderImport({ seed: (s) => seedReferenceMax(s, BENCH, 90) });
    await importText(
      document({
        referenceMaxes: [
          { exercise: SQUAT, kg: 140 },
          { exercise: BENCH, kg: 100 },
        ],
      }),
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Save plan' }));
    await waitFor(() => expect(onImported).toHaveBeenCalled());
    const current = selectCurrentMaxes(store.getState());
    expect(current[SQUAT].kg).toBe(140);
    expect(current[SQUAT].origin).toBe('import');
    expect(current[BENCH].kg).toBe(90);
    expect(store.getState().plans[0].workouts[0].programs?.[0].programId).toBe('sheiko-29');
  });

  it('sends unresolved names used as role targets, scheme bases and 1RM exercises through the resolver', async () => {
    const { store, onImported } = await renderImport();
    await importText(
      json({
        ...base,
        workouts: [
          {
            name: 'A',
            programs: [{ program: 'smolov-jr', day: 1, roles: { lift: 'Agachamento hack zumbi' } }],
            exercises: [
              {
                exercise: BENCH,
                percent: { of: 'Supino zumbi', weeks: [[{ sets: 3, reps: 5, percent: 70 }]] },
              },
            ],
          },
        ],
        referenceMaxes: [{ exercise: 'Terra zumbi', kg: 150 }],
      }),
    );
    expect(await screen.findByText('Exercises to resolve')).toBeOnTheScreen();
    expect(screen.getByText('Agachamento hack zumbi')).toBeOnTheScreen();
    expect(screen.getByText('Supino zumbi')).toBeOnTheScreen();
    expect(screen.getByText('Terra zumbi')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save plan' })).toBeDisabled();
    expect(screen.queryByText('Will be set')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getAllByRole('button', { name: 'Choose another exercise' })[0]);
    await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'Barbell Back Squat');
    await fireEvent.press((await screen.findAllByRole('button', { name: 'Barbell Back Squat' })).at(-1)!);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Choose another exercise' })[0]);
    await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'Barbell Bench Press');
    await fireEvent.press((await screen.findAllByRole('button', { name: 'Barbell Bench Press' })).at(-1)!);
    // the third becomes a new exercise
    await fireEvent.press(screen.getByRole('button', { name: 'Create as new exercise' }));
    await fireEvent.press(await screen.findByTestId('form-primary-back'));
    await fireEvent.press(screen.getByTestId('form-equipment-barbell'));
    await fireEvent.press(screen.getByRole('button', { name: 'Use this exercise' }));

    expect(await screen.findByText('Smolov Jr. · day 1 → Barbell Back Squat')).toBeOnTheScreen();
    expect(screen.getByText('Percentages of the 1RM of Barbell Bench Press')).toBeOnTheScreen();
    // the exercise to create has no 1RM yet: it will be set
    expect(await screen.findByText(`Terra zumbi: 150.0${NBSP}kg`)).toBeOnTheScreen();

    const save = screen.getByRole('button', { name: 'Save plan' });
    await waitFor(() => expect(save).toBeEnabled());
    await fireEvent.press(save);
    await waitFor(() => expect(onImported).toHaveBeenCalled());
    const created = store.getState().customExercises[0];
    expect(created.name.en).toBe('Terra zumbi');
    expect(selectCurrentMaxes(store.getState())[created.id].kg).toBe(150);
  });
});
