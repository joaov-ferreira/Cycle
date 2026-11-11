import type { CustomExerciseInput } from '@/domain/exercise';
import type { Plan } from '@/domain/plan';
import type { Workout } from '@/domain/workout';

import { ProfileNotFoundError, type Clock, type Profile, type Settings } from '../repositories';

export type StoredCustomExercise = {
  id: number;
  profileId: number;
  input: CustomExerciseInput;
  archived: boolean;
};

/** The data shared by the in-memory repositories (they reference each other's rows). */
export type MemoryState = {
  clock: Clock;
  profiles: Map<number, Profile>;
  settings: Map<number, Settings>;
  activePlanIds: Map<number, number | null>;
  customExercises: Map<number, StoredCustomExercise>;
  increments: Map<number, Map<string, number>>;
  plans: Map<number, Plan>;
  workouts: Map<number, Workout>;
  nextId: { profile: number; custom: number; plan: number; workout: number };
};

export function createMemoryState(clock: Clock): MemoryState {
  return {
    clock,
    profiles: new Map(),
    settings: new Map(),
    activePlanIds: new Map(),
    customExercises: new Map(),
    increments: new Map(),
    plans: new Map(),
    workouts: new Map(),
    nextId: { profile: 1, custom: 1, plan: 1, workout: 1 },
  };
}

export function requireProfile(state: MemoryState, id: number): Profile {
  const found = state.profiles.get(id);
  if (!found) throw new ProfileNotFoundError(id);
  return found;
}
