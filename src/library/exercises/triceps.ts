import type { Exercise } from '../../domain/exercise';
import { ex, primary } from './define';

export const TRICEPS_EXERCISES: readonly Exercise[] = primary('triceps', [
  ex('triceps-pushdown', 'Triceps Pushdown', 'Tríceps na polia', 'cable', 'isolation', [], ['Tríceps pulley']),
  ex('triceps-rope-pushdown', 'Rope Triceps Pushdown', 'Tríceps corda na polia', 'cable', 'isolation', [], ['Tríceps corda']),
  ex('cable-overhead-triceps-extension', 'Cable Overhead Triceps Extension', 'Tríceps francês na polia', 'cable', 'isolation'),
  ex('dumbbell-overhead-triceps-extension', 'Dumbbell Overhead Triceps Extension', 'Tríceps francês com halteres', 'dumbbell', 'isolation', [], ['Tríceps francês']),
  ex('barbell-skull-crusher', 'Barbell Skull Crusher', 'Tríceps testa com barra', 'barbell', 'isolation', [], ['Tríceps testa', 'Skull crusher']),
  ex('dumbbell-skull-crusher', 'Dumbbell Skull Crusher', 'Tríceps testa com halteres', 'dumbbell', 'isolation'),
  ex('close-grip-bench-press', 'Close-Grip Bench Press', 'Supino fechado com barra', 'barbell', 'compound', ['chest', 'shoulders'], ['Supino pegada fechada']),
  ex('smith-close-grip-bench-press', 'Smith Close-Grip Bench Press', 'Supino fechado no Smith', 'smith', 'compound', ['chest', 'shoulders']),
  ex('parallel-bar-dip', 'Parallel Bar Dip', 'Mergulho nas paralelas', 'bodyweight', 'compound', ['chest', 'shoulders'], ['Mergulho', 'Triceps Dip']),
  ex('diamond-push-up', 'Diamond Push-Up', 'Flexão diamante', 'bodyweight', 'compound', ['chest', 'shoulders']),
  ex('dumbbell-triceps-kickback', 'Dumbbell Triceps Kickback', 'Tríceps coice com halteres', 'dumbbell', 'isolation', [], ['Coice de tríceps']),
  ex('machine-triceps-extension', 'Triceps Extension Machine', 'Tríceps na máquina', 'machine', 'isolation'),
  ex('band-triceps-pushdown', 'Band Triceps Pushdown', 'Tríceps com elástico', 'band', 'isolation'),
]);
