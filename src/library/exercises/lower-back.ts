import type { Exercise } from '../../domain/exercise';
import { ex, primary } from './define';

export const LOWER_BACK_EXERCISES: readonly Exercise[] = primary('lowerBack', [
  ex('conventional-deadlift', 'Conventional Deadlift', 'Levantamento terra', 'barbell', 'compound', ['glutes', 'hamstrings', 'traps'], ['Levantamento terra convencional', 'Deadlift']),
  ex('back-extension', 'Back Extension', 'Hiperextensão lombar', 'machine', 'isolation', ['glutes', 'hamstrings'], ['Hiperextensão']),
  ex('good-morning', 'Good Morning', 'Bom dia', 'barbell', 'compound', ['hamstrings', 'glutes']),
  ex('trap-bar-deadlift', 'Trap Bar Deadlift', 'Levantamento terra com barra hexagonal', 'barbell', 'compound', ['glutes', 'quads']),
  ex('seated-good-morning', 'Seated Good Morning', 'Bom dia sentado', 'barbell', 'compound', ['hamstrings', 'glutes']),
  ex('deadlift-to-knees', 'Deadlift to Knees', 'Levantamento terra até os joelhos', 'barbell', 'compound', ['glutes', 'hamstrings', 'traps'], ['Partial Deadlift']),
  ex('deadlift-from-boxes', 'Deadlift from Boxes', 'Levantamento terra em blocos', 'barbell', 'compound', ['glutes', 'hamstrings', 'traps'], ['Block Pull', 'Rack Pull', 'Levantamento terra a partir de blocos']),
  ex('deficit-deadlift', 'Deficit Deadlift', 'Levantamento terra em déficit', 'barbell', 'compound', ['glutes', 'hamstrings', 'quads'], ['Levantamento terra com déficit']),
  ex('reverse-hyperextension', 'Reverse Hyperextension', 'Hiperextensão reversa', 'machine', 'isolation', ['glutes', 'hamstrings']),
]);
