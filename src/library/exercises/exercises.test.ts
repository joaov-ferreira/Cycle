import {
  EQUIPMENT,
  MECHANICS,
  MUSCLE_GROUPS,
  isEquipment,
  isMechanics,
  isMuscleGroup,
  type Equipment,
  type Exercise,
  type MuscleGroup,
} from '../../domain/exercise';
import { BUILT_IN_EXERCISES, findExercise, listExercises } from './index';

/** SPEC §4.3 normalization, implemented locally so the data tests do not depend on stage 3b. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Normalized names and aliases claimed by more than one exercise, with the colliding ids. */
function findCollisions(exercises: readonly Exercise[]): string[] {
  const owners = new Map<string, Set<string>>();
  for (const exercise of exercises) {
    const texts = [exercise.name.en, exercise.name['pt-BR'], ...exercise.aliases];
    for (const text of texts) {
      const key = normalize(text);
      if (key === '') continue;
      const ids = owners.get(key) ?? new Set<string>();
      ids.add(exercise.id);
      owners.set(key, ids);
    }
  }
  return [...owners]
    .filter(([, ids]) => ids.size > 1)
    .map(([key, ids]) => `"${key}" -> ${[...ids].join(', ')}`);
}

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const MIN_PER_MUSCLE: Record<MuscleGroup, number> = {
  chest: 14,
  back: 18,
  shoulders: 14,
  traps: 4,
  biceps: 12,
  triceps: 12,
  forearms: 4,
  abs: 10,
  lowerBack: 5,
  glutes: 10,
  quads: 14,
  hamstrings: 10,
  adductors: 3,
  abductors: 3,
  calves: 6,
};

/** SPEC §2.2 contract: these exercises are referenced by other stages, tests and docs. */
const CONTRACT: readonly {
  id: string;
  primaryMuscle: MuscleGroup;
  equipment: Equipment;
  mechanics: 'compound' | 'isolation';
  en: string;
  ptBR: string;
}[] = [
  { id: 'barbell-bench-press', primaryMuscle: 'chest', equipment: 'barbell', mechanics: 'compound', en: 'Barbell Bench Press', ptBR: 'Supino reto com barra' },
  { id: 'barbell-back-squat', primaryMuscle: 'quads', equipment: 'barbell', mechanics: 'compound', en: 'Barbell Back Squat', ptBR: 'Agachamento livre' },
  { id: 'conventional-deadlift', primaryMuscle: 'lowerBack', equipment: 'barbell', mechanics: 'compound', en: 'Conventional Deadlift', ptBR: 'Levantamento terra' },
  { id: 'overhead-press', primaryMuscle: 'shoulders', equipment: 'barbell', mechanics: 'compound', en: 'Overhead Press', ptBR: 'Desenvolvimento com barra' },
  { id: 'barbell-row', primaryMuscle: 'back', equipment: 'barbell', mechanics: 'compound', en: 'Barbell Row', ptBR: 'Remada curvada' },
  { id: 'pull-up', primaryMuscle: 'back', equipment: 'bodyweight', mechanics: 'compound', en: 'Pull-Up', ptBR: 'Barra fixa' },
  { id: 'lat-pulldown', primaryMuscle: 'back', equipment: 'cable', mechanics: 'compound', en: 'Lat Pulldown', ptBR: 'Puxada alta' },
  { id: 'barbell-curl', primaryMuscle: 'biceps', equipment: 'barbell', mechanics: 'isolation', en: 'Barbell Curl', ptBR: 'Rosca direta com barra' },
  { id: 'dumbbell-curl', primaryMuscle: 'biceps', equipment: 'dumbbell', mechanics: 'isolation', en: 'Dumbbell Curl', ptBR: 'Rosca direta com halteres' },
  { id: 'triceps-pushdown', primaryMuscle: 'triceps', equipment: 'cable', mechanics: 'isolation', en: 'Triceps Pushdown', ptBR: 'Tríceps na polia' },
  { id: 'leg-press', primaryMuscle: 'quads', equipment: 'machine', mechanics: 'compound', en: 'Leg Press', ptBR: 'Leg press 45°' },
  { id: 'leg-extension', primaryMuscle: 'quads', equipment: 'machine', mechanics: 'isolation', en: 'Leg Extension', ptBR: 'Cadeira extensora' },
  { id: 'leg-curl', primaryMuscle: 'hamstrings', equipment: 'machine', mechanics: 'isolation', en: 'Lying Leg Curl', ptBR: 'Mesa flexora' },
  { id: 'romanian-deadlift', primaryMuscle: 'hamstrings', equipment: 'barbell', mechanics: 'compound', en: 'Romanian Deadlift', ptBR: 'Levantamento terra romeno' },
  { id: 'lateral-raise', primaryMuscle: 'shoulders', equipment: 'dumbbell', mechanics: 'isolation', en: 'Dumbbell Lateral Raise', ptBR: 'Elevação lateral' },
  { id: 'standing-calf-raise', primaryMuscle: 'calves', equipment: 'machine', mechanics: 'isolation', en: 'Standing Calf Raise', ptBR: 'Panturrilha em pé' },
  { id: 'dumbbell-fly', primaryMuscle: 'chest', equipment: 'dumbbell', mechanics: 'isolation', en: 'Dumbbell Fly', ptBR: 'Crucifixo com halteres' },
  // SPEC-v4 §4.2: variations and accessories of the restored programs.
  { id: 'seated-good-morning', primaryMuscle: 'lowerBack', equipment: 'barbell', mechanics: 'compound', en: 'Seated Good Morning', ptBR: 'Bom dia sentado' },
  { id: 'deadlift-to-knees', primaryMuscle: 'lowerBack', equipment: 'barbell', mechanics: 'compound', en: 'Deadlift to Knees', ptBR: 'Levantamento terra até os joelhos' },
  { id: 'deadlift-from-boxes', primaryMuscle: 'lowerBack', equipment: 'barbell', mechanics: 'compound', en: 'Deadlift from Boxes', ptBR: 'Levantamento terra em blocos' },
  { id: 'deficit-deadlift', primaryMuscle: 'lowerBack', equipment: 'barbell', mechanics: 'compound', en: 'Deficit Deadlift', ptBR: 'Levantamento terra em déficit' },
];

describe('built-in exercise library (SPEC §2.2)', () => {
  it('has at least 150 exercises', () => {
    expect(BUILT_IN_EXERCISES.length).toBeGreaterThanOrEqual(150);
  });

  it('has unique kebab-case ids', () => {
    const ids = BUILT_IN_EXERCISES.map((exercise) => exercise.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(KEBAB_CASE);
    }
  });

  it('gives every exercise trimmed, non-empty names in both locales', () => {
    for (const exercise of BUILT_IN_EXERCISES) {
      for (const text of [exercise.name.en, exercise.name['pt-BR']]) {
        expect({ id: exercise.id, text }).toEqual({ id: exercise.id, text: text.trim() });
        expect({ id: exercise.id, empty: text.length === 0 }).toEqual({ id: exercise.id, empty: false });
      }
    }
  });

  it('gives every alias trimmed, non-empty text', () => {
    for (const exercise of BUILT_IN_EXERCISES) {
      for (const alias of exercise.aliases) {
        expect({ id: exercise.id, alias }).toEqual({ id: exercise.id, alias: alias.trim() });
        expect({ id: exercise.id, empty: alias.length === 0 }).toEqual({ id: exercise.id, empty: false });
      }
    }
  });

  it('marks every exercise as built-in and not archived', () => {
    for (const exercise of BUILT_IN_EXERCISES) {
      expect({ id: exercise.id, custom: exercise.custom, archived: exercise.archived }).toEqual({
        id: exercise.id,
        custom: false,
        archived: false,
      });
    }
  });

  it('uses only valid muscle groups, equipment and mechanics', () => {
    for (const exercise of BUILT_IN_EXERCISES) {
      expect({ id: exercise.id, primary: isMuscleGroup(exercise.primaryMuscle) }).toEqual({
        id: exercise.id,
        primary: true,
      });
      expect({ id: exercise.id, equipment: isEquipment(exercise.equipment) }).toEqual({
        id: exercise.id,
        equipment: true,
      });
      expect({ id: exercise.id, mechanics: isMechanics(exercise.mechanics) }).toEqual({
        id: exercise.id,
        mechanics: true,
      });
    }
  });

  it('keeps secondary muscles valid, without the primary muscle and without duplicates', () => {
    for (const exercise of BUILT_IN_EXERCISES) {
      const secondary = exercise.secondaryMuscles;
      expect({ id: exercise.id, valid: secondary.every((m) => isMuscleGroup(m)) }).toEqual({
        id: exercise.id,
        valid: true,
      });
      expect({ id: exercise.id, hasPrimary: secondary.includes(exercise.primaryMuscle) }).toEqual({
        id: exercise.id,
        hasPrimary: false,
      });
      expect({ id: exercise.id, unique: new Set(secondary).size === secondary.length }).toEqual({
        id: exercise.id,
        unique: true,
      });
    }
  });

  it('meets the minimum number of primary exercises per muscle group', () => {
    for (const muscle of MUSCLE_GROUPS) {
      const count = BUILT_IN_EXERCISES.filter((exercise) => exercise.primaryMuscle === muscle).length;
      expect({ muscle, enough: count >= MIN_PER_MUSCLE[muscle] }).toEqual({ muscle, enough: true });
    }
  });

  it('has at least 5 exercises for every equipment except other', () => {
    for (const equipment of EQUIPMENT) {
      if (equipment === 'other') continue;
      const count = BUILT_IN_EXERCISES.filter((exercise) => exercise.equipment === equipment).length;
      expect({ equipment, enough: count >= 5 }).toEqual({ equipment, enough: true });
    }
  });

  it('uses both mechanics values', () => {
    for (const mechanics of MECHANICS) {
      const count = BUILT_IN_EXERCISES.filter((exercise) => exercise.mechanics === mechanics).length;
      expect({ mechanics, present: count > 0 }).toEqual({ mechanics, present: true });
    }
  });

  it('gives no two different exercises the same normalized name or alias', () => {
    expect(findCollisions(BUILT_IN_EXERCISES)).toEqual([]);
  });

  it('contains every contract exercise with its exact attributes', () => {
    for (const row of CONTRACT) {
      const exercise = findExercise(row.id);
      expect(exercise).toBeDefined();
      expect(exercise).toMatchObject({
        id: row.id,
        primaryMuscle: row.primaryMuscle,
        equipment: row.equipment,
        mechanics: row.mechanics,
        name: { en: row.en, 'pt-BR': row.ptBR },
      });
    }
  });

  it('accepts "Rosca direta" as an alias of barbell-curl', () => {
    expect(findExercise('barbell-curl')?.aliases).toContain('Rosca direta');
  });

  it('finds an exercise by id and returns undefined for an unknown id', () => {
    expect(findExercise('dumbbell-fly')?.name.en).toBe('Dumbbell Fly');
    expect(findExercise('no-such-exercise')).toBeUndefined();
  });

  it('lists exercises in MUSCLE_GROUPS order', () => {
    const listed = listExercises();
    expect(listed).toHaveLength(BUILT_IN_EXERCISES.length);
    const order = listed.map((exercise) => MUSCLE_GROUPS.indexOf(exercise.primaryMuscle));
    const sorted = [...order].sort((a, b) => a - b);
    expect(order).toEqual(sorted);
  });
});
