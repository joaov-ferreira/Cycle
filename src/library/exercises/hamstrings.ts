import type { Exercise } from '../../domain/exercise';
import { ex, primary } from './define';

export const HAMSTRINGS_EXERCISES: readonly Exercise[] = primary('hamstrings', [
  ex('romanian-deadlift', 'Romanian Deadlift', 'Levantamento terra romeno', 'barbell', 'compound', ['glutes', 'lowerBack'], ['RDL']),
  ex('stiff-leg-deadlift', 'Stiff-Leg Deadlift', 'Stiff com barra', 'barbell', 'compound', ['glutes', 'lowerBack'], ['Stiff']),
  ex('dumbbell-romanian-deadlift', 'Dumbbell Romanian Deadlift', 'Levantamento terra romeno com halteres', 'dumbbell', 'compound', ['glutes', 'lowerBack']),
  ex('kettlebell-romanian-deadlift', 'Kettlebell Romanian Deadlift', 'Levantamento terra romeno com kettlebell', 'kettlebell', 'compound', ['glutes', 'lowerBack']),
  ex('smith-romanian-deadlift', 'Smith Romanian Deadlift', 'Levantamento terra romeno no Smith', 'smith', 'compound', ['glutes', 'lowerBack']),
  ex('leg-curl', 'Lying Leg Curl', 'Mesa flexora', 'machine', 'isolation'),
  ex('seated-leg-curl', 'Seated Leg Curl', 'Cadeira flexora', 'machine', 'isolation'),
  ex('single-leg-curl', 'Single-Leg Lying Curl', 'Mesa flexora unilateral', 'machine', 'isolation'),
  ex('cable-leg-curl', 'Cable Leg Curl', 'Flexora na polia', 'cable', 'isolation'),
  ex('band-leg-curl', 'Band Leg Curl', 'Flexora com elástico', 'band', 'isolation'),
  ex('nordic-curl', 'Nordic Hamstring Curl', 'Flexora nórdica', 'bodyweight', 'isolation', [], ['Nordic curl']),
]);
