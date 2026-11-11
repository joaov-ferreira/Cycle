import type { Exercise } from '../../domain/exercise';
import { ex, primary } from './define';

export const QUADS_EXERCISES: readonly Exercise[] = primary('quads', [
  ex('barbell-back-squat', 'Barbell Back Squat', 'Agachamento livre', 'barbell', 'compound', ['glutes', 'hamstrings', 'lowerBack'], ['Back Squat']),
  ex('barbell-front-squat', 'Barbell Front Squat', 'Agachamento frontal', 'barbell', 'compound', ['glutes', 'lowerBack']),
  ex('barbell-sumo-squat', 'Barbell Sumo Squat', 'Agachamento sumô com barra', 'barbell', 'compound', ['glutes', 'hamstrings']),
  ex('leg-press', 'Leg Press', 'Leg press 45°', 'machine', 'compound', ['glutes', 'hamstrings']),
  ex('single-leg-press', 'Single-Leg Press', 'Leg press unilateral', 'machine', 'compound', ['glutes']),
  ex('hack-squat', 'Hack Squat', 'Agachamento hack', 'machine', 'compound', ['glutes']),
  ex('belt-squat', 'Belt Squat', 'Agachamento no cinto', 'machine', 'compound', ['glutes', 'hamstrings']),
  ex('leg-extension', 'Leg Extension', 'Cadeira extensora', 'machine', 'isolation'),
  ex('smith-squat', 'Smith Squat', 'Agachamento no Smith', 'smith', 'compound', ['glutes']),
  ex('kettlebell-goblet-squat', 'Kettlebell Goblet Squat', 'Agachamento goblet com kettlebell', 'kettlebell', 'compound', ['glutes']),
  ex('dumbbell-goblet-squat', 'Dumbbell Goblet Squat', 'Agachamento goblet com halter', 'dumbbell', 'compound', ['glutes']),
  ex('dumbbell-bulgarian-split-squat', 'Dumbbell Bulgarian Split Squat', 'Agachamento búlgaro com halteres', 'dumbbell', 'compound', ['glutes', 'hamstrings'], ['Agachamento búlgaro', 'Búlgaro']),
  ex('dumbbell-walking-lunge', 'Dumbbell Walking Lunge', 'Afundo com halteres', 'dumbbell', 'compound', ['glutes'], ['Passada']),
  ex('dumbbell-step-up', 'Dumbbell Step-Up', 'Subida no step com halteres', 'dumbbell', 'compound', ['glutes']),
  ex('bodyweight-squat', 'Bodyweight Squat', 'Agachamento sem carga', 'bodyweight', 'compound', ['glutes']),
]);
