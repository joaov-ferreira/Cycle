import type { Exercise } from '../../domain/exercise';
import { ex, primary } from './define';

export const ABS_EXERCISES: readonly Exercise[] = primary('abs', [
  ex('crunch', 'Crunch', 'Abdominal supra', 'bodyweight', 'isolation'),
  ex('sit-up', 'Sit-Up', 'Abdominal completo', 'bodyweight', 'isolation'),
  ex('reverse-crunch', 'Reverse Crunch', 'Abdominal reverso', 'bodyweight', 'isolation'),
  ex('hanging-leg-raise', 'Hanging Leg Raise', 'Elevação de pernas suspenso', 'bodyweight', 'isolation'),
  ex('lying-leg-raise', 'Lying Leg Raise', 'Elevação de pernas deitado', 'bodyweight', 'isolation', [], ['Elevação de pernas']),
  ex('cable-crunch', 'Cable Crunch', 'Abdominal na polia', 'cable', 'isolation', [], ['Crunch na polia']),
  ex('machine-crunch', 'Crunch Machine', 'Abdominal na máquina', 'machine', 'isolation'),
  ex('kettlebell-russian-twist', 'Kettlebell Russian Twist', 'Rotação russa com kettlebell', 'kettlebell', 'isolation'),
  ex('cable-woodchopper', 'Cable Woodchopper', 'Abdominal oblíquo na polia', 'cable', 'isolation', [], ['Oblíquo na polia']),
  ex('dumbbell-side-bend', 'Dumbbell Side Bend', 'Inclinação lateral com halter', 'dumbbell', 'isolation'),
  ex('ab-wheel-rollout', 'Ab Wheel Rollout', 'Roda abdominal', 'other', 'compound', ['shoulders'], ['Ab wheel']),
]);
