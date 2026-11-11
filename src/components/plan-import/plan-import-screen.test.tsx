import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createTestStore, seedPlan } from '@/test-utils/seed';
import { renderInApp, type RenderInAppOptions } from '@/test-utils/render-app';

import { PlanImportScreen, type PlanImportScreenProps } from './plan-import-screen';

// SPEC §13, step 2.
const SPEC_TEXT = `# My plan
cycle: 2+1
sessions: 2

## A
Supino reto com barra | 3x8-12
Minha remada especial | 3x8-12

## B
Agachamento livre | 3x6-10`;

// docs/IMPORT_FORMAT.md §7.
const FORMAT_EXAMPLE = `{
  "format": "cycle-plan",
  "version": 1,
  "name": "Upper / Lower 4x",
  "description": "Hypertrophy, four sessions a week.",
  "sessionsPerWeek": 4,
  "cycle": { "loadWeeks": 6, "deloadWeeks": 1, "deloadVolumeFactor": 0.5, "deloadLoadFactor": 0.9 },
  "customExercises": [
    {
      "key": "hammer-strength-row",
      "name": "Hammer Strength row",
      "primaryMuscle": "back",
      "secondaryMuscles": ["biceps"],
      "equipment": "machine",
      "mechanics": "compound"
    }
  ],
  "workouts": [
    {
      "name": "Upper A",
      "exercises": [
        { "exercise": "barbell-bench-press", "sets": 4, "reps": "6-10", "rir": 2, "rest": 150, "startLoad": 60 },
        { "exercise": "hammer-strength-row", "sets": 4, "reps": "8-12", "rir": 2, "rest": 120 },
        { "exercise": "overhead-press", "sets": 3, "reps": "8-12", "rir": 2, "rest": 120 },
        { "exercise": "lat-pulldown", "sets": 3, "reps": "10-15", "rir": 1, "rest": 90 },
        { "exercise": "dumbbell-curl", "sets": 3, "reps": "10-15", "rir": 1, "rest": 60 },
        { "exercise": "triceps-pushdown", "sets": 3, "reps": "10-15", "rir": 1, "rest": 60 }
      ]
    },
    {
      "name": "Lower A",
      "exercises": [
        { "exercise": "barbell-back-squat", "sets": 4, "reps": "6-10", "rir": 2, "rest": 180 },
        { "exercise": "romanian-deadlift", "sets": 3, "reps": "8-12", "rir": 2, "rest": 150 },
        { "exercise": "leg-extension", "sets": 3, "reps": "10-15", "rir": 1, "rest": 90 },
        { "exercise": "leg-curl", "sets": 3, "reps": "10-15", "rir": 1, "rest": 90 },
        { "exercise": "standing-calf-raise", "sets": 4, "reps": "10-15", "rir": 1, "rest": 60 }
      ]
    }
  ]
}`;

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

async function paste(text: string, label = 'Plan text') {
  await fireEvent.changeText(await screen.findByLabelText(label), text);
}

describe('PlanImportScreen: SPEC §13 flow', () => {
  it('previews, resolves the unknown exercise by creating it, and saves an active plan', async () => {
    const { store, onImported } = await renderImport({ language: 'pt-BR' });
    await paste(SPEC_TEXT, 'Texto da periodização');
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByText('My plan')).toBeOnTheScreen();
    expect(screen.getByText('2 semanas de carga + 1 semana de deload')).toBeOnTheScreen();
    expect(screen.getByText('2 sessões por semana')).toBeOnTheScreen();
    expect(screen.getAllByText('Supino reto com barra').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Agachamento livre').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Minha remada especial').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3 × 8–12').length).toBe(2);
    expect(screen.getByRole('button', { name: 'Salvar periodização' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Criar como novo exercício' }));
    expect(await screen.findByDisplayValue('Minha remada especial')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('form-primary-back'));
    await fireEvent.press(screen.getByTestId('form-equipment-machine'));
    await fireEvent.press(screen.getByRole('button', { name: 'Usar este exercício' }));

    // Nothing is created yet.
    expect(store.getState().customExercises).toHaveLength(0);
    const save = await screen.findByRole('button', { name: 'Salvar periodização' });
    await waitFor(() => expect(save).toBeEnabled());
    await fireEvent.press(save);

    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    const state = store.getState();
    expect(state.customExercises.map((exercise) => exercise.name.en)).toEqual(['Minha remada especial']);
    expect(state.customExercises[0]).toMatchObject({
      primaryMuscle: 'back',
      equipment: 'machine',
      mechanics: 'compound',
    });
    expect(state.plans).toHaveLength(1);
    expect(state.activePlanId).toBe(state.plans[0].id);
    expect(onImported).toHaveBeenCalledWith(expect.objectContaining({ id: state.plans[0].id, name: 'My plan' }));
    expect(state.plans[0].workouts[0].exercises[1].exerciseId).toBe(state.customExercises[0].id);
  });

  it('resolves an unknown name with a suggestion chip and can change the choice', async () => {
    const { store, onImported } = await renderImport();
    await paste(SPEC_TEXT);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText('Exercises to resolve');

    await fireEvent.press(screen.getByRole('button', { name: 'Barbell Row' }));
    expect(screen.getByText('Minha remada especial → Barbell Row')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save plan' })).toBeEnabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Change Minha remada especial' }));
    expect(screen.getByRole('button', { name: 'Save plan' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Barbell Row' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save plan' }));

    await waitFor(() => expect(onImported).toHaveBeenCalled());
    expect(store.getState().customExercises).toHaveLength(0);
    expect(store.getState().plans[0].workouts[0].exercises[1].exerciseId).toBe('barbell-row');
  });

  it('resolves an unknown name through the exercise chooser', async () => {
    const { store, onImported } = await renderImport();
    await paste(SPEC_TEXT);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Choose another exercise' }));
    await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'Pull-Up');
    await fireEvent.press(await screen.findByRole('button', { name: 'Pull-Up' }));

    expect(await screen.findByText('Minha remada especial → Pull-Up')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Save plan' }));
    await waitFor(() => expect(onImported).toHaveBeenCalled());
    expect(store.getState().plans[0].workouts[0].exercises[1].exerciseId).toBe('pull-up');
  });

  it('rejects a new exercise whose name collides with a library exercise', async () => {
    await renderImport();
    await paste(SPEC_TEXT);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Create as new exercise' }));
    await fireEvent.changeText(await screen.findByDisplayValue('Minha remada especial'), 'Barbell Row');
    await fireEvent.press(screen.getByTestId('form-primary-back'));
    await fireEvent.press(screen.getByTestId('form-equipment-machine'));
    await fireEvent.press(screen.getByRole('button', { name: 'Use this exercise' }));
    expect(await screen.findByText('An exercise with this name already exists')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save plan' })).toBeDisabled();
  });
});

describe('PlanImportScreen: JSON', () => {
  it('imports the IMPORT_FORMAT example pasted inside a fence with prose around it', async () => {
    const { store, onImported } = await renderImport();
    await paste(`Here is your plan!\n\n\`\`\`json\n${FORMAT_EXAMPLE}\n\`\`\`\n\nHave fun.`);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Upper / Lower 4x')).toBeOnTheScreen();
    expect(screen.queryByText('Exercises to resolve')).toBeNull();
    expect(screen.getByText('Hammer Strength row')).toBeOnTheScreen();
    expect(screen.getByText('Will be created')).toBeOnTheScreen();
    expect(screen.getByText('6 load weeks + 1 deload week')).toBeOnTheScreen();
    expect(screen.getAllByText('4 × 6–10').length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByRole('button', { name: 'Save plan' }));
    await waitFor(() => expect(onImported).toHaveBeenCalled());
    expect(store.getState().customExercises.map((exercise) => exercise.name.en)).toEqual(['Hammer Strength row']);
    expect(store.getState().plans[0].name).toBe('Upper / Lower 4x');
  });

  it('shows the JSON path of each error', async () => {
    await renderImport();
    await paste(
      '{"format":"cycle-plan","version":1,"name":"X","workouts":[{"name":"A","exercises":[{"exercise":"barbell-bench-press","sets":0,"reps":"8-12"}]}]}',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('The plan could not be read')).toBeOnTheScreen();
    expect(
      screen.getByText('workouts[0].exercises[0].sets: This number is outside the allowed range.'),
    ).toBeOnTheScreen();
  });
});

describe('PlanImportScreen: errors in plain text', () => {
  const BAD = '## A\nSupino reto com barra | 3x8-12\nRemada | tres';

  it('lists localized messages with line numbers in English', async () => {
    await renderImport();
    await paste(BAD);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText('Line 3: This exercise line could not be read. Use: name | 4x8-12.'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('import-errors')).toBeOnTheScreen();
  });

  it('lists localized messages with line numbers in Portuguese', async () => {
    await renderImport({ language: 'pt-BR' });
    await paste(BAD, 'Texto da periodização');
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    expect(
      await screen.findByText('Linha 3: Não foi possível ler esta linha de exercício. Use: nome | 4x8-12.'),
    ).toBeOnTheScreen();
  });

  it('asks for text when the field is empty', async () => {
    await renderImport();
    await fireEvent.press(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Paste or pick a plan first.')).toBeOnTheScreen();
  });

  it('keeps the text when going back from the preview', async () => {
    await renderImport();
    await paste(SPEC_TEXT);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit text' }));
    expect(await screen.findByLabelText('Plan text')).toHaveDisplayValue(SPEC_TEXT);
  });
});

describe('PlanImportScreen: file', () => {
  it('puts the text of the picked file in the field', async () => {
    const pickFile = jest.fn().mockResolvedValue({ name: 'plan.txt', text: SPEC_TEXT, size: 200 });
    await renderImport({ pickFile });
    await fireEvent.press(await screen.findByRole('button', { name: 'Pick a file' }));
    await waitFor(() => expect(screen.getByLabelText('Plan text')).toHaveDisplayValue(SPEC_TEXT));
  });

  it('keeps the field when the picker is cancelled', async () => {
    const pickFile = jest.fn().mockResolvedValue(null);
    await renderImport({ pickFile });
    await paste('abc');
    await fireEvent.press(screen.getByRole('button', { name: 'Pick a file' }));
    await waitFor(() => expect(pickFile).toHaveBeenCalled());
    expect(screen.getByLabelText('Plan text')).toHaveDisplayValue('abc');
  });

  it('rejects a file over 256 KB with a message', async () => {
    const pickFile = jest.fn().mockResolvedValue({ name: 'big.txt', text: '', size: 300 * 1024 });
    await renderImport({ pickFile });
    await fireEvent.press(await screen.findByRole('button', { name: 'Pick a file' }));
    expect(await screen.findByText('This file is larger than 256 KB.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Plan text')).toHaveDisplayValue('');
  });

  it('shows a message when the file cannot be read', async () => {
    const pickFile = jest.fn().mockRejectedValue(new Error('boom'));
    await renderImport({ pickFile, language: 'pt-BR' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Escolher arquivo' }));
    expect(await screen.findByText('Não foi possível ler o arquivo.')).toBeOnTheScreen();
  });
});

describe('PlanImportScreen: activation', () => {
  it('keeps the previous plan active when "Activate" is switched off', async () => {
    const { store, repos } = await createTestStore();
    const previous = await seedPlan(store);
    const { onImported } = await renderImport({ store, repos });
    await paste(SPEC_TEXT);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Barbell Row' }));

    expect(screen.getByRole('switch', { name: 'Activate this plan', checked: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('switch', { name: 'Activate this plan' }));
    expect(screen.getByRole('switch', { name: 'Activate this plan', checked: false })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Save plan' }));

    await waitFor(() => expect(onImported).toHaveBeenCalled());
    expect(store.getState().plans).toHaveLength(2);
    expect(store.getState().activePlanId).toBe(previous.id);
  });

  it('shows a localized message when the store rejects the plan', async () => {
    const { store, repos } = await createTestStore();
    store.setState({ importPlan: () => Promise.reject(new Error('disk')) });
    await renderImport({ store, repos });
    await paste(FORMAT_EXAMPLE);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Save plan' }));
    expect(await screen.findByText('The plan could not be saved.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save plan' })).toBeEnabled();
  });
});

describe('PlanImportScreen: Create with AI', () => {
  it('shows the four steps and the prompt in Portuguese, then shares it', async () => {
    const { store, repos } = await createTestStore();
    const kept = await store.getState().createCustomExercise({
      name: 'Minha remada especial',
      primaryMuscle: 'back',
      secondaryMuscles: [],
      equipment: 'machine',
      mechanics: 'compound',
    });
    const hidden = await store.getState().createCustomExercise({
      name: 'Exercício arquivado',
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      equipment: 'cable',
      mechanics: 'isolation',
    });
    await store.getState().setExerciseArchived(hidden.id, true);

    const share = jest.fn().mockResolvedValue(undefined);
    await renderImport({ store, repos, share, language: 'pt-BR' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Criar com IA' }));

    expect(await screen.findByRole('header', { name: 'Criar com IA' })).toBeOnTheScreen();
    expect(screen.getByText(/^1\. Copie o prompt/)).toBeOnTheScreen();
    expect(screen.getByText(/^4\. Volte aqui/)).toBeOnTheScreen();

    const prompt = screen.getByLabelText('Prompt para o chatbot').props.children as string;
    expect(prompt).toContain('barbell-bench-press — Supino reto com barra — chest — barbell');
    expect(prompt).toContain(`${kept.id} — Minha remada especial — back — machine`);
    expect(prompt).not.toContain('Exercício arquivado');
    expect(prompt.indexOf('barbell-bench-press')).toBeLessThan(prompt.indexOf(kept.id));

    await fireEvent.press(screen.getByRole('button', { name: 'Compartilhar' }));
    expect(share).toHaveBeenCalledWith(prompt);

    await fireEvent.press(screen.getByRole('button', { name: 'Voltar à importação' }));
    expect(await screen.findByLabelText('Texto da periodização')).toBeOnTheScreen();
  });

  it('builds the English prompt in English', async () => {
    await renderImport();
    await fireEvent.press(await screen.findByRole('button', { name: 'Create with AI' }));
    const prompt = (await screen.findByLabelText('Prompt for the chatbot')).props.children as string;
    expect(prompt).toContain('barbell-bench-press — Barbell Bench Press — chest — barbell');
  });
});

describe('PlanImportScreen: back', () => {
  it('calls onBack from the input step', async () => {
    const onBack = jest.fn();
    await renderImport({ onBack });
    await fireEvent.press(await screen.findByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
  });
});
