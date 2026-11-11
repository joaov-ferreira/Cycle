import type { Exercise } from '../../domain/exercise';
import { ex, primary } from './define';

export const TRAPS_EXERCISES: readonly Exercise[] = primary('traps', [
  ex('barbell-shrug', 'Barbell Shrug', 'Encolhimento com barra', 'barbell', 'isolation', [], ['Shrug']),
  ex('dumbbell-shrug', 'Dumbbell Shrug', 'Encolhimento com halteres', 'dumbbell', 'isolation'),
  ex('smith-shrug', 'Smith Shrug', 'Encolhimento no Smith', 'smith', 'isolation'),
  ex('machine-shrug', 'Shrug Machine', 'Encolhimento na máquina', 'machine', 'isolation'),
  ex('kettlebell-shrug', 'Kettlebell Shrug', 'Encolhimento com kettlebell', 'kettlebell', 'isolation'),
]);
