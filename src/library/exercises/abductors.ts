import type { Exercise } from '../../domain/exercise';
import { ex, primary } from './define';

export const ABDUCTORS_EXERCISES: readonly Exercise[] = primary('abductors', [
  ex('hip-abduction-machine', 'Hip Abduction Machine', 'Cadeira abdutora', 'machine', 'isolation', [], ['Abdutora']),
  ex('cable-hip-abduction', 'Cable Hip Abduction', 'Abdução na polia', 'cable', 'isolation'),
  ex('side-lying-hip-abduction', 'Side-Lying Hip Abduction', 'Abdução deitado', 'bodyweight', 'isolation'),
  ex('band-clamshell', 'Band Clamshell', 'Concha com elástico', 'band', 'isolation', [], ['Clamshell']),
]);
