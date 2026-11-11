import type { Exercise } from '../../domain/exercise';
import { ex, primary } from './define';

export const CALVES_EXERCISES: readonly Exercise[] = primary('calves', [
  ex('standing-calf-raise', 'Standing Calf Raise', 'Panturrilha em pé', 'machine', 'isolation'),
  ex('seated-calf-raise', 'Seated Calf Raise', 'Panturrilha sentado', 'machine', 'isolation', [], ['Panturrilha sentada']),
  ex('leg-press-calf-raise', 'Leg Press Calf Raise', 'Panturrilha no leg press', 'machine', 'isolation'),
  ex('donkey-calf-raise', 'Donkey Calf Raise', 'Panturrilha no burrinho', 'machine', 'isolation', [], ['Burrinho']),
  ex('smith-calf-raise', 'Smith Calf Raise', 'Panturrilha no Smith', 'smith', 'isolation'),
  ex('single-leg-calf-raise', 'Single-Leg Calf Raise', 'Panturrilha unilateral', 'bodyweight', 'isolation'),
  ex('dumbbell-calf-raise', 'Dumbbell Calf Raise', 'Panturrilha em pé com halter', 'dumbbell', 'isolation'),
]);
