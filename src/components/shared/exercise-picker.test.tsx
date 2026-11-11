import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Exercise } from '@/domain/exercise';
import { I18nProvider, type AppLocale } from '@/i18n';

import { ExercisePicker, type ExercisePickerProps } from './exercise-picker';

function exercise(overrides: Partial<Exercise> & Pick<Exercise, 'id' | 'name'>): Exercise {
  return {
    aliases: [],
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    mechanics: 'compound',
    custom: false,
    archived: false,
    ...overrides,
  };
}

const bench = exercise({
  id: 'barbell-bench-press',
  name: { en: 'Barbell Bench Press', 'pt-BR': 'Supino reto com barra' },
  aliases: ['Flat bench'],
});
const fly = exercise({
  id: 'dumbbell-fly',
  name: { en: 'Dumbbell Fly', 'pt-BR': 'Crucifixo com halteres' },
  aliases: ['Crucifixo'],
  equipment: 'dumbbell',
  mechanics: 'isolation',
});
const curl = exercise({
  id: 'dumbbell-curl',
  name: { en: 'Dumbbell Curl', 'pt-BR': 'Rosca direta com halteres' },
  primaryMuscle: 'biceps',
  equipment: 'dumbbell',
  mechanics: 'isolation',
});
const squat = exercise({
  id: 'barbell-back-squat',
  name: { en: 'Barbell Back Squat', 'pt-BR': 'Agachamento livre' },
  primaryMuscle: 'quads',
});
const pushdown = exercise({
  id: 'triceps-pushdown',
  name: { en: 'Triceps Pushdown', 'pt-BR': 'Tríceps na polia' },
  primaryMuscle: 'triceps',
  equipment: 'cable',
  mechanics: 'isolation',
});
const zercher = exercise({
  id: 'custom-7',
  name: { en: 'Zercher Squat', 'pt-BR': 'Zercher Squat' },
  primaryMuscle: 'quads',
  custom: true,
});
const oldDeck = exercise({
  id: 'custom-8',
  name: { en: 'Old Pec Deck', 'pt-BR': 'Pec deck antigo' },
  equipment: 'machine',
  custom: true,
  archived: true,
  mechanics: 'isolation',
});

const library = [bench, fly, curl, squat, pushdown, zercher, oldDeck];

async function renderPicker(
  props: Partial<ExercisePickerProps> = {},
  locale: AppLocale = 'en',
) {
  const onSelect = jest.fn();
  await render(
    <I18nProvider locale={locale}>
      <ExercisePicker exercises={library} onSelect={onSelect} {...props} />
    </I18nProvider>,
  );
  return { onSelect };
}

const search = (text: string) => fireEvent.changeText(screen.getByLabelText('Search exercises'), text);

describe('ExercisePicker: search', () => {
  it('lists the non-archived exercises by default', async () => {
    await renderPicker();
    for (const name of ['Barbell Bench Press', 'Dumbbell Fly', 'Barbell Back Squat', 'Zercher Squat']) {
      expect(screen.getByRole('button', { name })).toBeOnTheScreen();
    }
    expect(screen.queryByRole('button', { name: 'Old Pec Deck' })).toBeNull();
  });

  it('finds an exercise by its Portuguese name while the UI is in English', async () => {
    await renderPicker();
    await search('agachamento');
    expect(screen.getByRole('button', { name: 'Barbell Back Squat' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Dumbbell Fly' })).toBeNull();
  });

  it('finds an exercise by its English name', async () => {
    await renderPicker();
    await search('dumbbell fly');
    expect(screen.getByRole('button', { name: 'Dumbbell Fly' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Dumbbell Curl' })).toBeNull();
  });

  it('finds an exercise by an alias', async () => {
    await renderPicker();
    await search('flat bench');
    expect(screen.getByRole('button', { name: 'Barbell Bench Press' })).toBeOnTheScreen();
    await search('Crucifixo');
    expect(screen.getByRole('button', { name: 'Dumbbell Fly' })).toBeOnTheScreen();
  });

  it('ignores case and accents', async () => {
    await renderPicker();
    await search('TRICEPS NA POLIA');
    expect(screen.getByRole('button', { name: 'Triceps Pushdown' })).toBeOnTheScreen();
  });

  it('reports the selected exercise', async () => {
    const { onSelect } = await renderPicker();
    await fireEvent.press(screen.getByRole('button', { name: 'Barbell Back Squat' }));
    expect(onSelect).toHaveBeenCalledWith(squat);
  });
});

describe('ExercisePicker: filters', () => {
  it('filters by muscle group, then clears the filter with "All"', async () => {
    await renderPicker();
    await fireEvent.press(screen.getByRole('button', { name: 'Chest' }));
    expect(screen.getByRole('button', { name: 'Dumbbell Fly' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Dumbbell Curl' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Barbell Back Squat' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'All', selected: false }));
    expect(screen.getByRole('button', { name: 'Dumbbell Curl' })).toBeOnTheScreen();
  });

  it('filters by equipment', async () => {
    await renderPicker();
    await fireEvent.press(screen.getByRole('button', { name: 'Dumbbell' }));
    expect(screen.getByRole('button', { name: 'Dumbbell Curl' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Dumbbell Fly' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Barbell Bench Press' })).toBeNull();
  });

  it('combines the search with both filters', async () => {
    await renderPicker();
    await fireEvent.press(screen.getByRole('button', { name: 'Chest' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Dumbbell' }));
    await search('fly');
    expect(screen.getByRole('button', { name: 'Dumbbell Fly' })).toBeOnTheScreen();
    await search('bench');
    expect(screen.queryByRole('button', { name: 'Barbell Bench Press' })).toBeNull();
    expect(screen.getByRole('header', { name: 'No exercises found' })).toBeOnTheScreen();
  });
});

describe('ExercisePicker: rows', () => {
  it('shows the muscle and equipment under each name', async () => {
    await renderPicker();
    expect(screen.getByText('Chest · Barbell')).toBeOnTheScreen();
    expect(screen.getByText('Biceps · Dumbbell')).toBeOnTheScreen();
  });

  it('badges custom exercises only', async () => {
    await renderPicker();
    expect(screen.getAllByText('Custom')).toHaveLength(1);
  });

  it('localizes names, muscles and equipment in pt-BR', async () => {
    await renderPicker({}, 'pt-BR');
    expect(screen.getByRole('button', { name: 'Agachamento livre' })).toBeOnTheScreen();
    expect(screen.getByText('Peito · Halteres')).toBeOnTheScreen();
    expect(screen.getByLabelText('Buscar exercícios')).toBeOnTheScreen();
    expect(screen.getByText('Personalizado')).toBeOnTheScreen();
  });
});

describe('ExercisePicker: suggestions and exclusions', () => {
  it('shows suggestions first, under a heading, without repeating them', async () => {
    await renderPicker({ suggested: [bench] });
    const headers = (await screen.findAllByRole('header')).map((h) => h.props.children);
    expect(headers).toEqual(['Suggestions', 'Exercises']);
    expect(screen.getAllByRole('button', { name: 'Barbell Bench Press' })).toHaveLength(1);
  });

  it('hides excluded exercises, including suggested ones', async () => {
    await renderPicker({ excludeIds: ['dumbbell-curl', 'barbell-bench-press'], suggested: [bench] });
    expect(screen.queryByRole('button', { name: 'Dumbbell Curl' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Barbell Bench Press' })).toBeNull();
    expect(screen.queryByRole('header', { name: 'Suggestions' })).toBeNull();
  });

  it('never shows archived exercises, even when suggested', async () => {
    await renderPicker({ suggested: [oldDeck] });
    expect(screen.queryByRole('button', { name: 'Old Pec Deck' })).toBeNull();
  });
});

describe('ExercisePicker: empty state', () => {
  it('explains that nothing matches and offers to create the searched name', async () => {
    const onCreateNew = jest.fn();
    await renderPicker({ onCreateNew });
    await search('  Zumba ');
    expect(screen.getByRole('header', { name: 'No exercises found' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Create “Zumba”' }));
    expect(onCreateNew).toHaveBeenCalledWith('Zumba');
  });

  it('offers no creation without a callback', async () => {
    await renderPicker();
    await search('Zumba');
    expect(screen.getByRole('header', { name: 'No exercises found' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Create/ })).toBeNull();
  });

  it('offers a generic new exercise action when no search text is given', async () => {
    const onCreateNew = jest.fn();
    await renderPicker({ onCreateNew });
    await fireEvent.press(screen.getByRole('button', { name: 'Glutes' }));
    await fireEvent.press(screen.getByRole('button', { name: 'New exercise' }));
    expect(onCreateNew).toHaveBeenCalledWith('');
  });

  it('localizes the empty state and creation label in pt-BR', async () => {
    const onCreateNew = jest.fn();
    await renderPicker({ onCreateNew }, 'pt-BR');
    await fireEvent.changeText(screen.getByLabelText('Buscar exercícios'), 'Zumba');
    expect(screen.getByRole('header', { name: 'Nenhum exercício encontrado' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Criar “Zumba”' }));
    expect(onCreateNew).toHaveBeenCalledWith('Zumba');
  });
});
