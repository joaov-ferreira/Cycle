/**
 * Exercise model (SPEC §2.1). Pure: no I/O, no display strings. Built-in and custom
 * exercises share this shape.
 */

/** Text stored for both locales; custom exercises store the same text in both. */
export type LocalizedText = { en: string; 'pt-BR': string };

export const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'traps', 'biceps', 'triceps', 'forearms',
  'abs', 'lowerBack', 'glutes', 'quads', 'hamstrings', 'adductors', 'abductors', 'calves',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = [
  'barbell', 'dumbbell', 'machine', 'cable', 'smith', 'kettlebell',
  'bodyweight', 'band', 'other',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const MECHANICS = ['compound', 'isolation'] as const;
export type Mechanics = (typeof MECHANICS)[number];

export interface Exercise {
  /** Built-in: kebab-case slug; custom: `custom-<n>` (n = database id). */
  id: string;
  /** Custom exercises store the same text in both locales. */
  name: LocalizedText;
  /** Extra names accepted by the import matcher (any language). */
  aliases: string[];
  primaryMuscle: MuscleGroup;
  /** Never contains `primaryMuscle`, no duplicates. */
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  mechanics: Mechanics;
  custom: boolean;
  /** Custom only; archived exercises are hidden from pickers. */
  archived: boolean;
}

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

export function isMuscleGroup(value: unknown): value is MuscleGroup {
  return isOneOf(MUSCLE_GROUPS, value);
}

export function isEquipment(value: unknown): value is Equipment {
  return isOneOf(EQUIPMENT, value);
}

export function isMechanics(value: unknown): value is Mechanics {
  return isOneOf(MECHANICS, value);
}

/** What the user provides to create or edit a custom exercise (SPEC §2.3). */
export type CustomExerciseInput = { name: string } & Pick<
  Exercise,
  'primaryMuscle' | 'secondaryMuscles' | 'equipment' | 'mechanics'
>;

/** Name length limits of a custom exercise (after trimming). */
export const CUSTOM_EXERCISE_NAME = { min: 1, max: 60 } as const;

/**
 * Only bodyweight and band exercises accept a logged weight of 0 (the weight is then the
 * added load). Every other equipment requires a weight above zero.
 */
export function allowsZeroLoad(equipment: Equipment): boolean {
  return equipment === 'bodyweight' || equipment === 'band';
}

/** Default load increment per equipment, in kg (SPEC §2.1). */
export const DEFAULT_INCREMENT_KG: Record<Equipment, number> = {
  barbell: 2.5,
  smith: 2.5,
  dumbbell: 1,
  kettlebell: 4,
  machine: 5,
  cable: 5,
  bodyweight: 2.5,
  band: 1,
  other: 2.5,
};

/** Range and granularity of a per-exercise increment override, in kg (SPEC §2.1). */
export const INCREMENT_OVERRIDE_LIMITS = { min: 0.25, max: 25, step: 0.25 } as const;

/**
 * The load increment for an exercise: the user's override when it is a number, otherwise the
 * default of its equipment.
 */
export function incrementFor(
  exercise: Pick<Exercise, 'equipment'>,
  override?: number | null,
): number {
  return typeof override === 'number' ? override : DEFAULT_INCREMENT_KG[exercise.equipment];
}
