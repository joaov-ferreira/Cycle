import type { Exercise } from '../../domain/exercise';
import { ex, primary } from './define';

export const CHEST_EXERCISES: readonly Exercise[] = primary('chest', [
  ex('barbell-bench-press', 'Barbell Bench Press', 'Supino reto com barra', 'barbell', 'compound', ['triceps', 'shoulders'], ['Bench Press', 'Supino reto']),
  ex('dumbbell-bench-press', 'Dumbbell Bench Press', 'Supino reto com halteres', 'dumbbell', 'compound', ['triceps', 'shoulders'], ['Supino com halteres']),
  ex('incline-barbell-bench-press', 'Incline Barbell Bench Press', 'Supino inclinado com barra', 'barbell', 'compound', ['shoulders', 'triceps']),
  ex('incline-dumbbell-press', 'Incline Dumbbell Press', 'Supino inclinado com halteres', 'dumbbell', 'compound', ['shoulders', 'triceps']),
  ex('decline-barbell-bench-press', 'Decline Barbell Bench Press', 'Supino declinado com barra', 'barbell', 'compound', ['triceps']),
  ex('smith-bench-press', 'Smith Bench Press', 'Supino reto no Smith', 'smith', 'compound', ['triceps', 'shoulders']),
  ex('smith-incline-bench-press', 'Smith Incline Bench Press', 'Supino inclinado no Smith', 'smith', 'compound', ['shoulders', 'triceps']),
  ex('machine-chest-press', 'Machine Chest Press', 'Supino na máquina', 'machine', 'compound', ['triceps', 'shoulders'], ['Chest Press']),
  ex('incline-machine-chest-press', 'Incline Machine Chest Press', 'Supino inclinado na máquina', 'machine', 'compound', ['shoulders', 'triceps']),
  ex('push-up', 'Push-Up', 'Flexão de braço', 'bodyweight', 'compound', ['triceps', 'shoulders'], ['Flexão']),
  ex('chest-dip', 'Chest Dip', 'Mergulho para peitoral', 'bodyweight', 'compound', ['triceps', 'shoulders']),
  ex('dumbbell-fly', 'Dumbbell Fly', 'Crucifixo com halteres', 'dumbbell', 'isolation', ['shoulders'], ['Crucifixo']),
  ex('incline-dumbbell-fly', 'Incline Dumbbell Fly', 'Crucifixo inclinado com halteres', 'dumbbell', 'isolation', ['shoulders']),
  ex('cable-crossover', 'Cable Crossover', 'Crossover na polia', 'cable', 'isolation', [], ['Crossover']),
  ex('low-cable-fly', 'Low Cable Fly', 'Crucifixo baixo na polia', 'cable', 'isolation'),
  ex('pec-deck-fly', 'Pec Deck Fly', 'Voador (peck deck)', 'machine', 'isolation', [], ['Peck deck', 'Voador']),
  ex('dumbbell-pullover', 'Dumbbell Pullover', 'Pullover com halteres', 'dumbbell', 'compound', ['back', 'triceps']),
]);
