import type { Equipment, Exercise, Mechanics, MuscleGroup } from '../../domain/exercise';

/** A built-in exercise before its primary muscle group is known (see `primary`). */
export type LibraryEntry = Omit<Exercise, 'primaryMuscle' | 'custom' | 'archived'>;

/** Compact constructor for one built-in exercise (SPEC §2.2). */
export function ex(
  id: string,
  en: string,
  ptBR: string,
  equipment: Equipment,
  mechanics: Mechanics,
  secondaryMuscles: MuscleGroup[] = [],
  aliases: string[] = [],
): LibraryEntry {
  return { id, name: { en, 'pt-BR': ptBR }, aliases, secondaryMuscles, equipment, mechanics };
}

/** Completes entries with their primary muscle group and the built-in flags. */
export function primary(primaryMuscle: MuscleGroup, entries: readonly LibraryEntry[]): Exercise[] {
  return entries.map((entry) => ({ ...entry, primaryMuscle, custom: false, archived: false }));
}
