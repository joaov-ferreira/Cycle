import type { CustomExerciseInput, Exercise } from './exercise';
import {
  createExerciseIndex,
  matchExercise,
  normalizeName,
  searchExercises,
  suggestExercises,
  validateCustomExercise,
} from './exercise-match';

function ex(partial: Partial<Exercise> & { id: string }): Exercise {
  return {
    name: { en: partial.id, 'pt-BR': partial.id },
    aliases: [],
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    mechanics: 'compound',
    custom: false,
    archived: false,
    ...partial,
  };
}

const BENCH = ex({
  id: 'barbell-bench-press',
  name: { en: 'Barbell Bench Press', 'pt-BR': 'Supino reto com barra' },
  aliases: ['Supino reto', 'Bench press'],
  secondaryMuscles: ['triceps', 'shoulders'],
});
const SQUAT = ex({
  id: 'barbell-back-squat',
  name: { en: 'Barbell Back Squat', 'pt-BR': 'Agachamento livre' },
  aliases: ['Squat'],
  primaryMuscle: 'quads',
});
const ROW = ex({
  id: 'barbell-row',
  name: { en: 'Barbell Row', 'pt-BR': 'Remada curvada' },
  primaryMuscle: 'back',
});
const CURL = ex({
  id: 'dumbbell-curl',
  name: { en: 'Dumbbell Curl', 'pt-BR': 'Rosca direta com halteres' },
  aliases: ['Rosca direta'],
  primaryMuscle: 'biceps',
  equipment: 'dumbbell',
  mechanics: 'isolation',
});
const LEG_PRESS = ex({
  id: 'leg-press',
  name: { en: 'Leg Press', 'pt-BR': 'Leg press 45°' },
  primaryMuscle: 'quads',
  equipment: 'machine',
});
const PULL_UP = ex({
  id: 'pull-up',
  name: { en: 'Pull-up', 'pt-BR': 'Barra fixa' },
  primaryMuscle: 'back',
  equipment: 'bodyweight',
});
const HAMMER = ex({
  id: 'custom-1',
  name: { en: 'Hammer Row', 'pt-BR': 'Hammer Row' },
  primaryMuscle: 'back',
  equipment: 'machine',
  custom: true,
});
const OLD = ex({
  id: 'custom-2',
  name: { en: 'Old Machine', 'pt-BR': 'Old Machine' },
  primaryMuscle: 'chest',
  equipment: 'machine',
  custom: true,
  archived: true,
});
const FIXTURE = [BENCH, SQUAT, ROW, CURL, LEG_PRESS, PULL_UP, HAMMER, OLD];

describe('normalizeName', () => {
  it('lowercases, strips diacritics and collapses punctuation', () => {
    expect(normalizeName('Supino Reto c/ Barra')).toBe('supino reto c barra');
    expect(normalizeName('Leg press 45°')).toBe('leg press 45');
    expect(normalizeName('  Tríceps   na polia!! ')).toBe('triceps na polia');
    expect(normalizeName('Pull-up')).toBe('pull up');
    expect(normalizeName('')).toBe('');
    expect(normalizeName('---')).toBe('');
  });
});

describe('matchExercise', () => {
  const index = createExerciseIndex(FIXTURE);

  it('matches an exact id (trimmed)', () => {
    expect(matchExercise(index, ' barbell-row ')).toBe(ROW);
    expect(matchExercise(index, 'custom-1')).toBe(HAMMER);
  });

  it('matches English and Portuguese names and aliases, ignoring case, accents and punctuation', () => {
    expect(matchExercise(index, 'BARBELL BENCH PRESS')).toBe(BENCH);
    expect(matchExercise(index, 'supino reto com barra')).toBe(BENCH);
    expect(matchExercise(index, 'Supino Reto')).toBe(BENCH);
    expect(matchExercise(index, 'bench-press')).toBe(BENCH);
    expect(matchExercise(index, 'Rosca direta')).toBe(CURL);
    expect(matchExercise(index, 'leg press 45')).toBe(LEG_PRESS);
    expect(matchExercise(index, 'Leg Press 45°')).toBe(LEG_PRESS);
    expect(matchExercise(index, 'Pull up')).toBe(PULL_UP);
    expect(matchExercise(index, 'agachamento LIVRE')).toBe(SQUAT);
  });

  it('matches the normalized id', () => {
    expect(matchExercise(index, 'Barbell Back Squat')).toBe(SQUAT);
    expect(matchExercise(index, 'dumbbell curl')).toBe(CURL);
  });

  it('never matches archived exercises', () => {
    expect(matchExercise(index, 'custom-2')).toBeNull();
    expect(matchExercise(index, 'Old Machine')).toBeNull();
  });

  it('never matches fuzzily', () => {
    expect(matchExercise(index, 'Supino')).toBeNull();
    expect(matchExercise(index, 'Supino reto com barras')).toBeNull();
    expect(matchExercise(index, '')).toBeNull();
    expect(matchExercise(index, '   ')).toBeNull();
  });

  it('lets the first exercise in index order win a collision', () => {
    const a = ex({ id: 'a', name: { en: 'Same', 'pt-BR': 'Same' } });
    const b = ex({ id: 'b', name: { en: 'same', 'pt-BR': 'same' } });
    expect(matchExercise(createExerciseIndex([a, b]), 'SAME')).toBe(a);
  });
});

describe('suggestExercises', () => {
  const index = createExerciseIndex(FIXTURE);

  it('suggests exercises that share a token, without matching them', () => {
    expect(matchExercise(index, 'Supino')).toBeNull();
    expect(suggestExercises(index, 'Supino')).toEqual([BENCH]);
  });

  it('ranks by the number of distinct shared tokens, ties in index order', () => {
    // "barbell row": ROW shares barbell+row (2); BENCH, SQUAT share barbell (1); HAMMER shares row (1)
    expect(suggestExercises(index, 'barbell row', 10)).toEqual([ROW, BENCH, SQUAT, HAMMER]);
  });

  it('counts a shared token once', () => {
    expect(suggestExercises(index, 'press press', 10)).toEqual([BENCH, LEG_PRESS]);
  });

  it('uses aliases and defaults the limit to 3', () => {
    expect(suggestExercises(index, 'rosca')).toEqual([CURL]);
    expect(suggestExercises(index, 'barbell')).toHaveLength(3);
    expect(suggestExercises(index, 'barbell', 2)).toEqual([BENCH, SQUAT]);
  });

  it('returns nothing without a shared token, and ignores archived exercises', () => {
    expect(suggestExercises(index, 'zzz')).toEqual([]);
    expect(suggestExercises(index, '')).toEqual([]);
    expect(suggestExercises(index, 'old machine')).toEqual([]);
  });
});

describe('searchExercises', () => {
  it('matches every query token as a substring of id, names and aliases', () => {
    expect(searchExercises(FIXTURE, 'sup ret')).toEqual([BENCH]);
    expect(searchExercises(FIXTURE, 'BENCH')).toEqual([BENCH]);
    expect(searchExercises(FIXTURE, 'tríc')).toEqual([]);
    expect(searchExercises(FIXTURE, 'barbell-row')).toEqual([ROW]);
    expect(searchExercises(FIXTURE, '45')).toEqual([LEG_PRESS]);
  });

  it('returns everything (non-archived, input order) for an empty query', () => {
    expect(searchExercises(FIXTURE, '')).toEqual([BENCH, SQUAT, ROW, CURL, LEG_PRESS, PULL_UP, HAMMER]);
    expect(searchExercises(FIXTURE, ' !! ')).toHaveLength(7);
  });

  it('filters by primary muscle and equipment', () => {
    expect(searchExercises(FIXTURE, '', { muscle: 'back' })).toEqual([ROW, PULL_UP, HAMMER]);
    expect(searchExercises(FIXTURE, '', { equipment: 'machine' })).toEqual([LEG_PRESS, HAMMER]);
    expect(searchExercises(FIXTURE, 'row', { muscle: 'back', equipment: 'machine' })).toEqual([HAMMER]);
    expect(searchExercises(FIXTURE, '', { muscle: 'triceps' })).toEqual([]);
  });

  it('includes archived exercises only when asked', () => {
    expect(searchExercises(FIXTURE, 'old')).toEqual([]);
    expect(searchExercises(FIXTURE, 'old', { includeArchived: true })).toEqual([OLD]);
  });
});

describe('validateCustomExercise (SPEC §2.3)', () => {
  const valid: CustomExerciseInput = {
    name: 'Cable Crossover Low',
    primaryMuscle: 'chest',
    secondaryMuscles: ['shoulders'],
    equipment: 'cable',
    mechanics: 'isolation',
  };

  it('accepts a valid input', () => {
    expect(validateCustomExercise(valid, FIXTURE)).toEqual({});
  });

  it('requires a name and limits it to 60 characters after trimming', () => {
    expect(validateCustomExercise({ ...valid, name: '   ' }, FIXTURE)).toEqual({ name: 'required' });
    expect(validateCustomExercise({ ...valid, name: 'a'.repeat(61) }, FIXTURE)).toEqual({ name: 'tooLong' });
    expect(validateCustomExercise({ ...valid, name: ` ${'a'.repeat(60)} ` }, FIXTURE)).toEqual({});
  });

  it('rejects names colliding (normalized) with names, aliases or ids', () => {
    expect(validateCustomExercise({ ...valid, name: 'supino RETO' }, FIXTURE)).toEqual({ name: 'duplicateName' });
    expect(validateCustomExercise({ ...valid, name: 'Bench Press' }, FIXTURE)).toEqual({ name: 'duplicateName' });
    expect(validateCustomExercise({ ...valid, name: 'barbell-row' }, FIXTURE)).toEqual({ name: 'duplicateName' });
    expect(validateCustomExercise({ ...valid, name: 'Hammer row' }, FIXTURE)).toEqual({ name: 'duplicateName' });
  });

  it('ignores archived exercises and the exercise being edited', () => {
    expect(validateCustomExercise({ ...valid, name: 'old machine' }, FIXTURE)).toEqual({});
    expect(validateCustomExercise({ ...valid, name: 'Hammer row' }, FIXTURE, 'custom-1')).toEqual({});
  });

  it('validates muscle, equipment, mechanics and secondary muscles', () => {
    const bad = {
      ...valid,
      primaryMuscle: 'neck',
      equipment: 'rock',
      mechanics: 'sideways',
    } as unknown as CustomExerciseInput;
    expect(validateCustomExercise(bad, FIXTURE)).toEqual({
      primaryMuscle: 'invalidMuscle',
      equipment: 'invalidEquipment',
      mechanics: 'invalidMechanics',
    });
    const invalid = (secondaryMuscles: unknown) =>
      validateCustomExercise({ ...valid, secondaryMuscles } as CustomExerciseInput, FIXTURE);
    expect(invalid(['chest'])).toEqual({ secondaryMuscles: 'invalidSecondaryMuscles' });
    expect(invalid(['back', 'back'])).toEqual({ secondaryMuscles: 'invalidSecondaryMuscles' });
    expect(invalid(['wings'])).toEqual({ secondaryMuscles: 'invalidSecondaryMuscles' });
    expect(invalid('back')).toEqual({ secondaryMuscles: 'invalidSecondaryMuscles' });
    expect(invalid([])).toEqual({});
  });
});
