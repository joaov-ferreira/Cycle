import type { Exercise } from '../../domain/exercise';
import { ex, primary } from './define';

export const LOWER_BACK_EXERCISES: readonly Exercise[] = primary('lowerBack', [
  ex('conventional-deadlift', 'Conventional Deadlift', 'Levantamento terra', 'barbell', 'compound', ['glutes', 'hamstrings', 'traps'], ['Levantamento terra convencional', 'Deadlift']),
  ex('back-extension', 'Back Extension', 'Hiperextensão lombar', 'machine', 'isolation', ['glutes', 'hamstrings'], ['Hiperextensão']),
  ex('good-morning', 'Good Morning', 'Bom dia', 'barbell', 'compound', ['hamstrings', 'glutes']),
  ex('trap-bar-deadlift', 'Trap Bar Deadlift', 'Levantamento terra com barra hexagonal', 'barbell', 'compound', ['glutes', 'quads']),
  ex('reverse-hyperextension', 'Reverse Hyperextension', 'Hiperextensão reversa', 'machine', 'isolation', ['glutes', 'hamstrings']),
]);
