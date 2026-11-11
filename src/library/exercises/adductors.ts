import type { Exercise } from '../../domain/exercise';
import { ex, primary } from './define';

export const ADDUCTORS_EXERCISES: readonly Exercise[] = primary('adductors', [
  ex('hip-adduction-machine', 'Hip Adduction Machine', 'Cadeira adutora', 'machine', 'isolation', [], ['Adutora']),
  ex('cable-hip-adduction', 'Cable Hip Adduction', 'Adução na polia', 'cable', 'isolation'),
  ex('side-lying-hip-adduction', 'Side-Lying Hip Adduction', 'Adução deitado', 'bodyweight', 'isolation'),
  ex('band-hip-adduction', 'Band Hip Adduction', 'Adução com elástico', 'band', 'isolation'),
]);
