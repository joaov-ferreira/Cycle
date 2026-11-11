import type { BodyMetric } from '@/domain/body';
import type { CustomExerciseInput } from '@/domain/exercise';
import type { Plan } from '@/domain/plan';
import type { Workout } from '@/domain/workout';

import {
  ProfileNotFoundError,
  type Clock,
  type ExerciseSettingsEntry,
  type Profile,
  type Settings,
} from '../repositories';

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
  /** Profile id → exercise id → increment override, note and bar weight. */
  exerciseSettings: Map<number, Map<string, ExerciseSettingsEntry>>;
  plans: Map<number, Plan>;
  workouts: Map<number, Workout>;
  bodyMetrics: Map<number, BodyMetric>;
  nextId: { profile: number; custom: number; plan: number; workout: number; bodyMetric: number };
};

export function createMemoryState(clock: Clock): MemoryState {
  return {
    clock,
    profiles: new Map(),
    settings: new Map(),
    activePlanIds: new Map(),
    customExercises: new Map(),
    exerciseSettings: new Map(),
    plans: new Map(),
    workouts: new Map(),
    bodyMetrics: new Map(),
    nextId: { profile: 1, custom: 1, plan: 1, workout: 1, bodyMetric: 1 },
  };
}

export function requireProfile(state: MemoryState, id: number): Profile {
  const found = state.profiles.get(id);
  if (!found) throw new ProfileNotFoundError(id);
  return found;
}

/** A copy of the collections a restore writes to, to undo it when it fails midway. */
export type MemorySnapshot = Omit<MemoryState, 'clock'>;

export function snapshotState(state: MemoryState): MemorySnapshot {
  const nested = <V>(map: Map<number, Map<string, V>>) =>
    new Map([...map].map(([key, inner]) => [key, new Map(inner)] as const));
  return {
    profiles: new Map(state.profiles),
    settings: new Map(state.settings),
    activePlanIds: new Map(state.activePlanIds),
    customExercises: new Map(state.customExercises),
    exerciseSettings: nested(state.exerciseSettings),
    plans: new Map(state.plans),
    workouts: new Map(state.workouts),
    bodyMetrics: new Map(state.bodyMetrics),
    nextId: { ...state.nextId },
  };
}

export function restoreSnapshot(state: MemoryState, snapshot: MemorySnapshot): void {
  state.profiles = snapshot.profiles;
  state.settings = snapshot.settings;
  state.activePlanIds = snapshot.activePlanIds;
  state.customExercises = snapshot.customExercises;
  state.exerciseSettings = snapshot.exerciseSettings;
  state.plans = snapshot.plans;
  state.workouts = snapshot.workouts;
  state.bodyMetrics = snapshot.bodyMetrics;
  state.nextId = snapshot.nextId;
}
