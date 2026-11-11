import type { Exercise } from '../../domain/exercise';
import { ex, primary } from './define';

export const GLUTES_EXERCISES: readonly Exercise[] = primary('glutes', [
  ex('barbell-hip-thrust', 'Barbell Hip Thrust', 'Elevação pélvica com barra', 'barbell', 'compound', ['hamstrings'], ['Hip Thrust']),
  ex('dumbbell-hip-thrust', 'Dumbbell Hip Thrust', 'Elevação pélvica com halter', 'dumbbell', 'compound', ['hamstrings']),
  ex('smith-hip-thrust', 'Smith Hip Thrust', 'Elevação pélvica no Smith', 'smith', 'compound', ['hamstrings'], ['Hip thrust no Smith']),
  ex('hip-thrust-machine', 'Hip Thrust Machine', 'Elevação pélvica na máquina', 'machine', 'compound', ['hamstrings']),
  ex('kettlebell-swing', 'Kettlebell Swing', 'Swing com kettlebell', 'kettlebell', 'compound', ['hamstrings', 'lowerBack'], ['Swing']),
  ex('cable-pull-through', 'Cable Pull-Through', 'Puxada entre as pernas na polia', 'cable', 'compound', ['hamstrings'], ['Pull-through']),
  ex('cable-glute-kickback', 'Cable Glute Kickback', 'Glúteo coice na polia', 'cable', 'isolation', [], ['Glúteo na polia']),
  ex('glute-kickback-machine', 'Glute Kickback Machine', 'Glúteo coice na máquina', 'machine', 'isolation', [], ['Glúteo na máquina']),
  ex('band-glute-bridge', 'Band Glute Bridge', 'Elevação pélvica com elástico', 'band', 'compound', ['hamstrings']),
  ex('glute-bridge', 'Glute Bridge', 'Ponte de glúteo', 'bodyweight', 'compound', ['hamstrings']),
  ex('donkey-kick', 'Quadruped Donkey Kick', 'Glúteo coice no solo', 'bodyweight', 'isolation', [], ['Donkey kick']),
]);
