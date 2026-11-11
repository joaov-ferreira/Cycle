/**
 * Exercise name matching, search and custom-exercise validation (SPEC §2.3, §2.4, §4.3).
 * Pure: no I/O, no display strings (error codes only).
 */
import {
  CUSTOM_EXERCISE_NAME,
  isEquipment,
  isMechanics,
  isMuscleGroup,
  type CustomExerciseInput,
  type Equipment,
  type Exercise,
  type MuscleGroup,
} from './exercise';

/**
 * Lowercase, strip diacritics, replace every run of non-alphanumeric characters with one
 * space, trim. `"Supino Reto c/ Barra"` → `"supino reto c barra"`.
 */
export function normalizeName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function tokensOf(normalized: string): string[] {
  return normalized === '' ? [] : normalized.split(' ');
}

/** Every text an exercise can be referred to by, normalized (names and aliases only). */
function namesOf(exercise: Exercise): string[] {
  return [exercise.name.en, exercise.name['pt-BR'], ...exercise.aliases].map(normalizeName);
}

export interface ExerciseIndex {
  /** Non-archived exercises, in input order. */
  readonly exercises: readonly Exercise[];
  readonly byId: ReadonlyMap<string, Exercise>;
  /** Normalized id, names and aliases → exercise (first in index order wins). */
  readonly byNormalized: ReadonlyMap<string, Exercise>;
  /** Normalized tokens of names and aliases, parallel to `exercises`. */
  readonly tokens: readonly ReadonlySet<string>[];
}

/** Lookup structure over the non-archived exercises. */
export function createExerciseIndex(exercises: readonly Exercise[]): ExerciseIndex {
  const active = exercises.filter((exercise) => !exercise.archived);
  const byId = new Map<string, Exercise>();
  const byNormalized = new Map<string, Exercise>();
  const tokens: Set<string>[] = [];
  for (const exercise of active) {
    if (!byId.has(exercise.id)) byId.set(exercise.id, exercise);
    const names = namesOf(exercise);
    for (const key of [normalizeName(exercise.id), ...names]) {
      if (key !== '' && !byNormalized.has(key)) byNormalized.set(key, exercise);
    }
    tokens.push(new Set(names.flatMap(tokensOf)));
  }
  return { exercises: active, byId, byNormalized, tokens };
}

/** Exact id match first, then exact match on normalized text. Never fuzzy. */
export function matchExercise(index: ExerciseIndex, reference: string): Exercise | null {
  const byId = index.byId.get(reference.trim());
  if (byId) return byId;
  const normalized = normalizeName(reference);
  return normalized === '' ? null : (index.byNormalized.get(normalized) ?? null);
}

/**
 * Exercises sharing at least one normalized token with the reference, ranked by the number
 * of distinct shared tokens (descending), ties in index order.
 */
export function suggestExercises(index: ExerciseIndex, reference: string, limit = 3): Exercise[] {
  const wanted = new Set(tokensOf(normalizeName(reference)));
  const scored: { exercise: Exercise; shared: number; position: number }[] = [];
  index.exercises.forEach((exercise, position) => {
    let shared = 0;
    for (const token of wanted) if (index.tokens[position].has(token)) shared += 1;
    if (shared > 0) scored.push({ exercise, shared, position });
  });
  scored.sort((a, b) => b.shared - a.shared || a.position - b.position);
  return scored.slice(0, limit).map((entry) => entry.exercise);
}

export interface ExerciseSearchFilters {
  muscle?: MuscleGroup;
  equipment?: Equipment;
  includeArchived?: boolean;
}

/** Picker search (SPEC §2.4): every query token is a substring of the normalized haystack. */
export function searchExercises(
  exercises: readonly Exercise[],
  query: string,
  filters: ExerciseSearchFilters = {},
): Exercise[] {
  const queryTokens = tokensOf(normalizeName(query));
  return exercises.filter((exercise) => {
    if (exercise.archived && !filters.includeArchived) return false;
    if (filters.muscle && exercise.primaryMuscle !== filters.muscle) return false;
    if (filters.equipment && exercise.equipment !== filters.equipment) return false;
    if (queryTokens.length === 0) return true;
    const haystack = [normalizeName(exercise.id), ...namesOf(exercise)].join(' ');
    return queryTokens.every((token) => haystack.includes(token));
  });
}

export interface CustomExerciseErrors {
  name?: 'required' | 'tooLong' | 'duplicateName';
  primaryMuscle?: 'invalidMuscle';
  equipment?: 'invalidEquipment';
  mechanics?: 'invalidMechanics';
  secondaryMuscles?: 'invalidSecondaryMuscles';
}

/** SPEC §2.3. An empty object means valid. `others` may include archived exercises. */
export function validateCustomExercise(
  input: CustomExerciseInput,
  others: readonly Exercise[],
  editingId?: string,
): CustomExerciseErrors {
  const errors: CustomExerciseErrors = {};
  const name = input.name.trim();
  if (name.length < CUSTOM_EXERCISE_NAME.min) {
    errors.name = 'required';
  } else if (name.length > CUSTOM_EXERCISE_NAME.max) {
    errors.name = 'tooLong';
  } else {
    const normalized = normalizeName(name);
    const taken = others.some(
      (other) =>
        !other.archived &&
        other.id !== editingId &&
        (normalizeName(other.id) === normalized || namesOf(other).includes(normalized)),
    );
    if (taken) errors.name = 'duplicateName';
  }
  if (!isMuscleGroup(input.primaryMuscle)) errors.primaryMuscle = 'invalidMuscle';
  if (!isEquipment(input.equipment)) errors.equipment = 'invalidEquipment';
  if (!isMechanics(input.mechanics)) errors.mechanics = 'invalidMechanics';
  const secondary: unknown = input.secondaryMuscles;
  if (
    !Array.isArray(secondary) ||
    !secondary.every(isMuscleGroup) ||
    new Set(secondary).size !== secondary.length ||
    secondary.includes(input.primaryMuscle)
  ) {
    errors.secondaryMuscles = 'invalidSecondaryMuscles';
  }
  return errors;
}
