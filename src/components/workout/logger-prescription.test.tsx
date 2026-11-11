import { fireEvent, screen, within } from '@testing-library/react-native';

import { DEFAULT_CYCLE } from '@/domain/cycle';
import type { PlanContent, PlanExercise } from '@/domain/plan';
import { findProgram } from '@/library';
import { selectEffectiveWorkout, type AppStore } from '@/state';
import {
  BENCH,
  DEADLIFT,
  seedReferenceMax,
  seedStrengthProfile,
  SQUAT,
  v1ExamplePlan,
  v3PlanContent,
  v4PlanContent,
} from '@/test-utils/seed';

import { renderWorkout, type WorkoutContext } from './workout-test-utils';

const card = (index: number) => within(screen.getByTestId(`exercise-card-${index}`));
const nbsp = (text: string) => text.replace(/ /g, ' ');

const percentExercise = (
  id: string,
  exerciseId: string,
  sets: NonNullable<PlanExercise['percent']>['weeks'][number]['sets'],
  basisExerciseId?: string,
): PlanExercise => ({
  id,
  exerciseId,
  sets: 3,
  repMin: 5,
  repMax: 5,
  percent: { weeks: [{ sets }], ...(basisExerciseId ? { basisExerciseId } : {}) },
});

const planOf = (exercises: PlanExercise[]): PlanContent => ({
  name: 'Strength',
  description: '',
  sessionsPerWeek: 1,
  cycle: { ...DEFAULT_CYCLE, loadWeeks: 3, deloadWeeks: 0 },
  workouts: [{ id: 'w-x', name: 'Heavy day', exercises }],
});

const startX = async ({ store }: WorkoutContext) => {
  await store.getState().startPlanWorkout('w-x');
};

const exerciseOf = (store: AppStore, index: number) => store.getState().currentWorkout!.exercises[index];

describe('logger: exercise with a prescription', () => {
  it('shows the origin of a program block, the 1RM and each set with % and load', async () => {
    await renderWorkout({
      planContent: v4PlanContent(),
      prepare: async ({ store }) => {
        await seedStrengthProfile(store);
        await store.getState().startPlanWorkout('w-531');
      },
    });
    expect(await card(0).findByText('5/3/1 (custom) · week 1 · day 1')).toBeOnTheScreen();
    expect(card(0).getByText(nbsp('1RM 100 kg'))).toBeOnTheScreen();
    expect(card(0).getAllByText(nbsp('75% → 75 kg'))).toHaveLength(3);
    expect(card(0).getByLabelText('Set 1 reps')).toHaveProp('placeholder', '5');
    expect(card(0).getByLabelText('Set 1 weight')).toHaveDisplayValue('75');
  });

  it('shows the origin of a scheme, the exact and rounded loads, and the basis exercise', async () => {
    await renderWorkout({
      planContent: planOf([
        percentExercise('pe-bench', BENCH, [{ reps: 5, percent: 72.5, repeat: 2 }], SQUAT),
      ]),
      prepare: async ({ store }) => {
        await seedReferenceMax(store, SQUAT, 102.5);
        await startX({ store } as WorkoutContext);
      },
    });
    expect(await card(0).findByText('Percent of 1RM · week 1')).toBeOnTheScreen();
    expect(card(0).getByText(nbsp('1RM 102.5 kg (Barbell Back Squat)'))).toBeOnTheScreen();
    expect(card(0).getAllByText(nbsp('72.5% → 74.31 → 75 kg'))).toHaveLength(2);
  });

  it('formats the load line and the 1RM with the Portuguese separator', async () => {
    await renderWorkout({
      language: 'pt-BR',
      planContent: planOf([percentExercise('pe-bench', BENCH, [{ reps: 5, percent: 72.5 }], SQUAT)]),
      prepare: async ({ store }) => {
        await seedReferenceMax(store, SQUAT, 102.5);
        await startX({ store } as WorkoutContext);
      },
    });
    expect(await card(0).findByText('Percentual do 1RM · semana 1')).toBeOnTheScreen();
    expect(card(0).getByText(nbsp('1RM 102,5 kg (Agachamento livre)'))).toBeOnTheScreen();
    expect(card(0).getByText(nbsp('72,5% → 74,31 → 75 kg'))).toBeOnTheScreen();
  });

  it('shows added kilograms, AMRAP and unverified sets, and extra sets', async () => {
    await renderWorkout({
      planContent: planOf([
        percentExercise('pe-bench', BENCH, [
          { reps: 3, percent: 70, addKg: 2.5 },
          { reps: 5, percent: 80, amrap: true },
          { reps: 5, unverified: true },
        ]),
      ]),
      prepare: async ({ store }) => {
        await seedReferenceMax(store, BENCH, 100);
        await startX({ store } as WorkoutContext);
        await store.getState().addSet(0);
      },
    });
    expect(await card(0).findByText(nbsp('70% +2.5 kg → 72.5 kg'))).toBeOnTheScreen();
    expect(card(0).getByText(nbsp('80% → 80 kg'))).toBeOnTheScreen();
    expect(card(0).getByText('AMRAP')).toBeOnTheScreen();
    expect(card(0).getByLabelText('Set 2 reps')).toHaveProp('placeholder', '5+');
    expect(card(0).getByText('Unverified data')).toBeOnTheScreen();
    expect(card(0).getByLabelText('Set 3 weight')).toHaveDisplayValue('');
    expect(card(0).getByText('Extra')).toBeOnTheScreen();
  });

  it('confirms the prescribed reps when a set is ticked with empty reps, and shows the e1RM', async () => {
    const { store } = await renderWorkout({
      planContent: planOf([percentExercise('pe-bench', BENCH, [{ reps: 5, percent: 75, repeat: 2 }])]),
      prepare: async ({ store: s }) => {
        await seedReferenceMax(s, BENCH, 100);
        await startX({ store: s } as WorkoutContext);
      },
    });
    await fireEvent.press(await card(0).findByRole('checkbox', { name: 'Set 1 done' }));
    expect(exerciseOf(store, 0).sets[0]).toMatchObject({ done: true, reps: 5, weightKg: 75 });
    expect(await card(0).findByText(nbsp('e1RM ≈ 87.5 kg'))).toBeOnTheScreen();
    expect(card(0).queryByText('Enter the reps')).toBeNull();
  });

  it('still asks for the reps of an AMRAP set', async () => {
    const { store } = await renderWorkout({
      planContent: planOf([percentExercise('pe-bench', BENCH, [{ reps: 5, percent: 75, amrap: true }])]),
      prepare: async ({ store: s }) => {
        await seedReferenceMax(s, BENCH, 100);
        await startX({ store: s } as WorkoutContext);
      },
    });
    await fireEvent.press(await card(0).findByRole('checkbox', { name: 'Set 1 done' }));
    expect(await card(0).findByText('Enter the reps')).toBeOnTheScreen();
    expect(exerciseOf(store, 0).sets[0].done).toBe(false);
    await fireEvent.changeText(card(0).getByLabelText('Set 1 reps'), '7');
    await fireEvent.press(card(0).getByRole('checkbox', { name: 'Set 1 done' }));
    expect(exerciseOf(store, 0).sets[0]).toMatchObject({ done: true, reps: 7 });
  });

  it('keeps the plate calculator on the prescribed load', async () => {
    await renderWorkout({
      planContent: planOf([percentExercise('pe-bench', BENCH, [{ reps: 5, percent: 75 }])]),
      prepare: async ({ store }) => {
        await seedReferenceMax(store, BENCH, 100);
        await startX({ store } as WorkoutContext);
      },
    });
    await fireEvent.press(await card(0).findByRole('button', { name: 'Plates' }));
    expect(await card(0).findByText(/^75\skg: .* per side$/)).toBeOnTheScreen();
  });
});

describe('logger: warm-ups on a prescription', () => {
  it('adds warm-ups from the prescribed work load without shifting the prescribed sets', async () => {
    const { store } = await renderWorkout({
      planContent: planOf([percentExercise('pe-bench', BENCH, [{ reps: 5, percent: 80, repeat: 2 }])]),
      prepare: async ({ store: s }) => {
        await seedReferenceMax(s, BENCH, 100);
        await startX({ store: s } as WorkoutContext);
      },
    });
    await fireEvent.press(await card(0).findByRole('button', { name: 'Add warm-up' }));
    await screen.findAllByText('W');
    const sets = exerciseOf(store, 0).sets;
    expect(sets[0].kind).toBe('warmup');
    expect(sets.filter((set) => set.kind === 'working').map((set) => set.weightKg)).toEqual([80, 80]);
    expect(card(0).getAllByText(nbsp('80% → 80 kg'))).toHaveLength(2);
  });
});

describe('logger: missing 1RM', () => {
  const missing = () =>
    planOf([percentExercise('pe-dl', DEADLIFT, [{ reps: 5, percent: 80, repeat: 2 }])]);

  it('asks for the 1RM, saves it and fills in the loads', async () => {
    const { store } = await renderWorkout({ planContent: missing(), prepare: startX });
    expect(await card(0).findByText('Set the 1RM to get loads')).toBeOnTheScreen();
    expect(card(0).queryByText(/^1RM \d/)).toBeNull();
    await fireEvent.changeText(card(0).getByLabelText('1RM of Conventional Deadlift'), '180');
    await fireEvent.press(card(0).getByRole('button', { name: 'Save 1RM' }));
    expect(await card(0).findAllByText(nbsp('80% → 144 → 145 kg'))).toHaveLength(2);
    expect(card(0).queryByText('Set the 1RM to get loads')).toBeNull();
    expect(exerciseOf(store, 0).sets[0].weightKg).toBe(145);
    expect(store.getState().referenceMaxes.map((m) => [m.exerciseId, m.kg, m.origin])).toEqual([
      [DEADLIFT, 180, 'manual'],
    ]);
  });

  it('accepts a decimal comma in Portuguese', async () => {
    await renderWorkout({ language: 'pt-BR', planContent: missing(), prepare: startX });
    expect(await card(0).findByText('Defina o 1RM para obter as cargas')).toBeOnTheScreen();
    await fireEvent.changeText(card(0).getByLabelText('1RM de Levantamento terra'), '182,5');
    await fireEvent.press(card(0).getByRole('button', { name: 'Salvar 1RM' }));
    expect(await card(0).findAllByText(nbsp('80% → 146 → 145 kg'))).toHaveLength(2);
  });

  it('shows a message when the store rejects the value', async () => {
    await renderWorkout({ planContent: missing(), prepare: startX });
    await fireEvent.changeText(await card(0).findByLabelText('1RM of Conventional Deadlift'), '1500');
    await fireEvent.press(card(0).getByRole('button', { name: 'Save 1RM' }));
    expect(await card(0).findByText('Use a value up to 1,000 kg')).toBeOnTheScreen();
    await fireEvent.changeText(card(0).getByLabelText('1RM of Conventional Deadlift'), '100.123');
    await fireEvent.press(card(0).getByRole('button', { name: 'Save 1RM' }));
    expect(await card(0).findByText('Use at most 2 decimal places')).toBeOnTheScreen();
  });

  it('does not save an empty field', async () => {
    const { store } = await renderWorkout({ planContent: missing(), prepare: startX });
    await fireEvent.press(await card(0).findByRole('button', { name: 'Save 1RM' }));
    expect(store.getState().referenceMaxes).toEqual([]);
  });
});

describe('logger: generated exercises', () => {
  it('shows the program, the variation label and the basis 1RM of a Sheiko block', async () => {
    const sheiko = findProgram('sheiko-29')!;
    const { store } = await renderWorkout({
      planContent: v1ExamplePlan(),
      prepare: async ({ store: s }) => {
        await seedStrengthProfile(s);
        await s.getState().startPlanWorkout('w4');
      },
    });
    const first = exerciseOf(store, 0);
    const source = first.prescription!.source;
    if (source.kind !== 'program') throw new Error('expected a program prescription');
    expect(source.label).toBeDefined();
    await card(0).findByText(`${sheiko.name} · ${source.label!.en} · week 1 · day 2`);
    expect(first.exerciseId).not.toBe(DEADLIFT);
    expect(card(0).getByText(/^1RM 180\skg \(Conventional Deadlift\)$/)).toBeOnTheScreen();
  });

  it('shows the program note of a free exercise above its sets', async () => {
    const content: PlanContent = {
      name: 'Smolov',
      description: '',
      sessionsPerWeek: 1,
      cycle: { ...DEFAULT_CYCLE, loadWeeks: 3, deloadWeeks: 0 },
      workouts: [
        {
          id: 'w-max',
          name: 'Max day',
          exercises: [],
          programs: [
            { id: 'pmax', programId: 'smolov', day: 3, startWeek: 6, roles: { squat: SQUAT }, accessories: false },
          ],
        },
      ],
    };
    const { store } = await renderWorkout({
      planContent: content,
      prepare: async ({ store: s }) => {
        await s.getState().startPlanWorkout('w-max');
      },
    });
    const plan = store.getState().plans[0];
    const effective = selectEffectiveWorkout(store.getState(), plan.id, 0)!.workout.exercises[0];
    expect(effective.generated?.kind).toBe('free');
    const note = effective.generated!.note!.en;
    expect(await card(0).findByText(note)).toBeOnTheScreen();
    expect(card(0).getByLabelText('Set 1 weight')).toBeOnTheScreen();
    expect(card(0).queryByText('Set the 1RM to get loads')).toBeNull();
  });

  it('falls back gracefully when the plan no longer has the workout', async () => {
    await renderWorkout({
      planContent: v4PlanContent(),
      prepare: async ({ store }) => {
        await seedStrengthProfile(store);
        await store.getState().startPlanWorkout('w-531');
        const plan = store.getState().plans[0];
        await store.getState().updatePlan(plan.id, { ...v4PlanContent(), workouts: v4PlanContent().workouts.slice(1) });
      },
    });
    expect(await card(0).findAllByText(nbsp("75% → 75 kg"))).toHaveLength(3);
  });
});

describe('logger: effort scale', () => {
  const rpeMode = async ({ store }: WorkoutContext) => {
    await store.getState().setEffortScale('rpe');
    await store.getState().startPlanWorkout('w-a');
  };

  it('keeps RIR by default, with half points', async () => {
    const { store } = await renderWorkout({ prepare: async ({ store: s }) => void (await s.getState().startPlanWorkout('w-a')) });
    await fireEvent.changeText(await card(0).findByLabelText('Set 1 RIR'), '1.5');
    expect(exerciseOf(store, 0).sets[0].rir).toBe(1.5);
  });

  it('shows RPE in the header, the inputs and the plan target, storing RIR', async () => {
    const { store } = await renderWorkout({
      planContent: v3PlanContent(),
      prepare: rpeMode,
    });
    // RIR ramp 3 → 0: week 1 target RIR 3 reads RPE 7.
    expect(await card(0).findByText('3 × 8–12 · RPE 7 this week · 120 s')).toBeOnTheScreen();
    expect(card(0).getAllByText('RPE')).toHaveLength(1);
    expect(card(0).queryByText('RIR')).toBeNull();
    await fireEvent.changeText(card(0).getByLabelText('Set 1 RPE'), '8');
    expect(exerciseOf(store, 0).sets[0].rir).toBe(2);
    expect(card(0).getByLabelText('Set 1 RPE')).toHaveDisplayValue('8');
  });

  it('reads the target as RPE in Portuguese', async () => {
    await renderWorkout({ language: 'pt-BR', planContent: v3PlanContent(), prepare: rpeMode });
    expect(await card(0).findByText('3 × 8–12 · RPE 7 nesta semana · 120 s')).toBeOnTheScreen();
    expect(card(0).getByLabelText('RPE da série 1')).toBeOnTheScreen();
  });

  it('names an off-step effort value when the set is ticked', async () => {
    await renderWorkout({ prepare: async ({ store }) => void (await store.getState().startPlanWorkout('w-a')) });
    await fireEvent.changeText(await card(0).findByLabelText('Set 1 weight'), '40');
    await fireEvent.changeText(card(0).getByLabelText('Set 1 reps'), '10');
    await fireEvent.changeText(card(0).getByLabelText('Set 1 RIR'), '1.3');
    await fireEvent.press(card(0).getByRole('checkbox', { name: 'Set 1 done' }));
    expect(await card(0).findByText('Use steps of 0.5')).toBeOnTheScreen();
  });
});
