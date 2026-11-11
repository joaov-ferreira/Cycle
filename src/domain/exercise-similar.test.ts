import type { Exercise, MuscleGroup } from './exercise';
import { similarExercises } from './exercise-similar';

function exercise(
  id: string,
  primaryMuscle: MuscleGroup,
  options: Partial<Pick<Exercise, 'mechanics' | 'secondaryMuscles' | 'archived'>> = {},
): Exercise {
  return {
    id,
    name: { en: id, 'pt-BR': id },
    aliases: [],
    primaryMuscle,
    secondaryMuscles: options.secondaryMuscles ?? [],
    equipment: 'barbell',
    mechanics: options.mechanics ?? 'compound',
    custom: false,
    archived: options.archived ?? false,
  };
}

// Target: barbell bench press, compound, chest, secondaries triceps and shoulders.
const bench = exercise('bench', 'chest', {
  secondaryMuscles: ['triceps', 'shoulders'],
});

const library: Exercise[] = [
  bench,
  // Same muscle, compound, shares 1 secondary (triceps) — listed 2nd.
  exercise('dips', 'chest', { secondaryMuscles: ['triceps'] }),
  // Same muscle, isolation, shares 2 secondaries — ranks after any compound match.
  exercise('cable-fly', 'chest', {
    mechanics: 'isolation',
    secondaryMuscles: ['triceps', 'shoulders'],
  }),
  // Same muscle, compound, shares 2 secondaries — ranks first among compounds.
  exercise('incline-press', 'chest', {
    secondaryMuscles: ['shoulders', 'triceps'],
  }),
  // Same muscle, compound, shares 0 secondaries, listed after the others (library order).
  exercise('push-up', 'chest', { secondaryMuscles: ['abs'] }),
  // Same muscle, compound, shares 2 secondaries, listed after incline-press (tie → order).
  exercise('decline-press', 'chest', {
    secondaryMuscles: ['triceps', 'shoulders'],
  }),
  // Archived: never suggested.
  exercise('old-press', 'chest', {
    secondaryMuscles: ['triceps', 'shoulders'],
    archived: true,
  }),
  // Other muscle: never suggested.
  exercise('overhead-press', 'shoulders', {
    secondaryMuscles: ['triceps'],
  }),
];

describe('similarExercises (SPEC-v3 §11)', () => {
  it('excludes the exercise itself, other primary muscles and archived exercises', () => {
    const ids = similarExercises(bench, library).map((e) => e.id);
    expect(ids).not.toContain('bench');
    expect(ids).not.toContain('overhead-press');
    expect(ids).not.toContain('old-press');
  });

  it('ranks by the same mechanics first, then by shared secondary muscles, then by library order', () => {
    // Compounds first: incline-press (2 shared, listed 4th), decline-press (2 shared, 6th),
    // dips (1 shared, 2nd), push-up (0 shared, 5th). Then the isolation cable-fly.
    const ids = similarExercises(bench, library).map((e) => e.id);
    expect(ids).toEqual([
      'incline-press',
      'decline-press',
      'dips',
      'push-up',
      'cable-fly',
    ]);
  });

  it('breaks ties between equal candidates by their order in the library', () => {
    const ids = similarExercises(bench, [
      bench,
      exercise('b', 'chest', { secondaryMuscles: ['triceps'] }),
      exercise('a', 'chest', { secondaryMuscles: ['triceps'] }),
    ]).map((e) => e.id);
    expect(ids).toEqual(['b', 'a']);
  });

  it('returns at most five exercises by default', () => {
    const many = [bench, ...Array.from({ length: 7 }, (_, i) => exercise(`c${i}`, 'chest'))];
    expect(similarExercises(bench, many)).toHaveLength(5);
  });

  it('honours an explicit limit', () => {
    expect(similarExercises(bench, library, 2).map((e) => e.id)).toEqual([
      'incline-press',
      'decline-press',
    ]);
  });

  it('a limit of 0 gives nothing', () => {
    expect(similarExercises(bench, library, 0)).toEqual([]);
  });

  it('returns nothing when no other exercise shares the primary muscle', () => {
    const lonely = exercise('calf-raise', 'calves');
    expect(similarExercises(lonely, library)).toEqual([]);
  });

  it('returns the library objects themselves', () => {
    const [first] = similarExercises(bench, library);
    expect(first).toBe(library[3]);
  });
});
