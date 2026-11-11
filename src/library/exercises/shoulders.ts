import type { Exercise } from '../../domain/exercise';
import { ex, primary } from './define';

export const SHOULDERS_EXERCISES: readonly Exercise[] = primary('shoulders', [
  ex('overhead-press', 'Overhead Press', 'Desenvolvimento com barra', 'barbell', 'compound', ['triceps'], ['Military Press', 'Desenvolvimento militar']),
  ex('dumbbell-shoulder-press', 'Dumbbell Shoulder Press', 'Desenvolvimento com halteres', 'dumbbell', 'compound', ['triceps']),
  ex('arnold-press', 'Arnold Press', 'Desenvolvimento Arnold', 'dumbbell', 'compound', ['triceps']),
  ex('machine-shoulder-press', 'Shoulder Press Machine', 'Desenvolvimento na máquina', 'machine', 'compound', ['triceps']),
  ex('smith-shoulder-press', 'Smith Shoulder Press', 'Desenvolvimento no Smith', 'smith', 'compound', ['triceps']),
  ex('kettlebell-overhead-press', 'Kettlebell Overhead Press', 'Desenvolvimento com kettlebell', 'kettlebell', 'compound', ['triceps']),
  ex('landmine-press', 'Landmine Press', 'Desenvolvimento landmine', 'barbell', 'compound', ['triceps']),
  ex('lateral-raise', 'Dumbbell Lateral Raise', 'Elevação lateral', 'dumbbell', 'isolation', [], ['Elevação lateral com halteres']),
  ex('cable-lateral-raise', 'Cable Lateral Raise', 'Elevação lateral na polia', 'cable', 'isolation'),
  ex('dumbbell-front-raise', 'Dumbbell Front Raise', 'Elevação frontal com halteres', 'dumbbell', 'isolation', ['chest']),
  ex('dumbbell-rear-delt-fly', 'Dumbbell Rear Delt Fly', 'Crucifixo inverso com halteres', 'dumbbell', 'isolation', ['back'], ['Crucifixo inverso']),
  ex('reverse-pec-deck', 'Reverse Pec Deck', 'Crucifixo inverso na máquina', 'machine', 'isolation', ['back']),
  ex('cable-face-pull', 'Cable Face Pull', 'Face pull na polia', 'cable', 'isolation', ['traps', 'back'], ['Face pull']),
  ex('barbell-upright-row', 'Barbell Upright Row', 'Remada alta com barra', 'barbell', 'compound', ['traps', 'biceps'], ['Remada alta']),
  ex('pike-push-up', 'Pike Push-Up', 'Flexão pike', 'bodyweight', 'compound', ['triceps']),
  ex('band-pull-apart', 'Band Pull-Apart', 'Abertura com elástico', 'band', 'isolation', ['back']),
]);
