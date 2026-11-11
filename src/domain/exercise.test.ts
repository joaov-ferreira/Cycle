import {
  allowsZeroLoad,
  CUSTOM_EXERCISE_NAME,
  type CustomExerciseInput,
  DEFAULT_INCREMENT_KG,
  EQUIPMENT,
  INCREMENT_OVERRIDE_LIMITS,
  incrementFor,
  isEquipment,
  isMechanics,
  isMuscleGroup,
  MUSCLE_GROUPS,
  type Exercise,
} from './exercise';

const squat: Exercise = {
  id: 'back-squat',
  name: { en: 'Back squat', 'pt-BR': 'Agachamento livre' },
  aliases: ['Squat'],
  primaryMuscle: 'quads',
  secondaryMuscles: ['glutes'],
  equipment: 'barbell',
  mechanics: 'compound',
  custom: false,
  archived: false,
};

describe('custom exercise input (SPEC §2.3)', () => {
  it('has a 1–60 character name limit', () => {
    expect(CUSTOM_EXERCISE_NAME).toEqual({ min: 1, max: 60 });
  });

  it('accepts the fields a user provides for a custom exercise', () => {
    const input: CustomExerciseInput = {
      name: 'Landmine press',
      primaryMuscle: 'shoulders',
      secondaryMuscles: ['triceps'],
      equipment: 'other',
      mechanics: 'compound',
    };
    expect(input.name).toBe('Landmine press');
  });
});

describe('MUSCLE_GROUPS and EQUIPMENT', () => {
  it('list the SPEC §2.1 values in order', () => {
    expect(MUSCLE_GROUPS).toEqual([
      'chest', 'back', 'shoulders', 'traps', 'biceps', 'triceps', 'forearms',
      'abs', 'lowerBack', 'glutes', 'quads', 'hamstrings', 'adductors', 'abductors', 'calves',
    ]);
    expect(EQUIPMENT).toEqual([
      'barbell', 'dumbbell', 'machine', 'cable', 'smith', 'kettlebell', 'bodyweight', 'band', 'other',
    ]);
  });
});

describe('type guards', () => {
  it.each(MUSCLE_GROUPS.map((value) => [value]))('isMuscleGroup accepts %p', (value) => {
    expect(isMuscleGroup(value)).toBe(true);
  });

  it.each([['Chest'], ['legs'], [''], [null], [undefined], [1], ['pt-BR']])(
    'isMuscleGroup rejects %p',
    (value) => {
      expect(isMuscleGroup(value)).toBe(false);
    },
  );

  it.each(EQUIPMENT.map((value) => [value]))('isEquipment accepts %p', (value) => {
    expect(isEquipment(value)).toBe(true);
  });

  it.each([['Barbell'], ['rope'], [''], [null], [7]])('isEquipment rejects %p', (value) => {
    expect(isEquipment(value)).toBe(false);
  });

  it.each([['compound'], ['isolation']])('isMechanics accepts %p', (value) => {
    expect(isMechanics(value)).toBe(true);
  });

  it.each([['Compound'], ['unilateral'], [null]])('isMechanics rejects %p', (value) => {
    expect(isMechanics(value)).toBe(false);
  });
});

describe('allowsZeroLoad', () => {
  it.each([
    ['bodyweight', true],
    ['band', true],
    ['barbell', false],
    ['dumbbell', false],
    ['machine', false],
    ['cable', false],
    ['smith', false],
    ['kettlebell', false],
    ['other', false],
  ] as const)('allowsZeroLoad(%p) is %p', (equipment, expected) => {
    expect(allowsZeroLoad(equipment)).toBe(expected);
  });
});

describe('DEFAULT_INCREMENT_KG (SPEC §2.1)', () => {
  it('has the default increment for every equipment', () => {
    expect(DEFAULT_INCREMENT_KG).toEqual({
      barbell: 2.5,
      smith: 2.5,
      dumbbell: 1,
      kettlebell: 4,
      machine: 5,
      cable: 5,
      bodyweight: 2.5,
      band: 1,
      other: 2.5,
    });
  });
});

describe('INCREMENT_OVERRIDE_LIMITS', () => {
  it('is 0.25 to 25 kg in 0.25 steps', () => {
    expect(INCREMENT_OVERRIDE_LIMITS).toEqual({ min: 0.25, max: 25, step: 0.25 });
  });
});

describe('incrementFor', () => {
  it('returns the equipment default when there is no override', () => {
    expect(incrementFor(squat)).toBe(2.5);
    expect(incrementFor({ ...squat, equipment: 'dumbbell' })).toBe(1);
  });

  it('returns the equipment default when the override is null', () => {
    expect(incrementFor(squat, null)).toBe(2.5);
  });

  it.each([[1], [1.25], [5], [0.25], [25]])('returns the override %p over the default', (override) => {
    expect(incrementFor(squat, override)).toBe(override);
    expect(incrementFor({ ...squat, equipment: 'machine' }, override)).toBe(override);
  });

  it('returns the default for other equipment when no override is given', () => {
    expect(incrementFor({ ...squat, equipment: 'machine' })).toBe(5);
    expect(incrementFor({ ...squat, equipment: 'kettlebell' })).toBe(4);
    expect(incrementFor({ ...squat, equipment: 'band' })).toBe(1);
  });
});
