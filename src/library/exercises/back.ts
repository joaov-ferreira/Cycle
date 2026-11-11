import type { Exercise } from '../../domain/exercise';
import { ex, primary } from './define';

export const BACK_EXERCISES: readonly Exercise[] = primary('back', [
  ex('pull-up', 'Pull-Up', 'Barra fixa', 'bodyweight', 'compound', ['biceps'], ['Pull up', 'Barra']),
  ex('chin-up', 'Chin-Up', 'Barra fixa supinada', 'bodyweight', 'compound', ['biceps'], ['Chin up', 'Barra supinada']),
  ex('lat-pulldown', 'Lat Pulldown', 'Puxada alta', 'cable', 'compound', ['biceps'], ['Pulley frente']),
  ex('close-grip-lat-pulldown', 'Close-Grip Lat Pulldown', 'Puxada alta pegada fechada', 'cable', 'compound', ['biceps'], ['Puxada supinada']),
  ex('straight-arm-pulldown', 'Straight-Arm Pulldown', 'Pulldown com braços estendidos', 'cable', 'isolation'),
  ex('barbell-row', 'Barbell Row', 'Remada curvada', 'barbell', 'compound', ['biceps', 'lowerBack'], ['Remada curvada com barra', 'Bent Over Row']),
  ex('pendlay-row', 'Pendlay Row', 'Remada Pendlay', 'barbell', 'compound', ['lowerBack', 'biceps']),
  ex('dumbbell-row', 'Dumbbell Row', 'Remada unilateral com halter', 'dumbbell', 'compound', ['biceps'], ['Serrote']),
  ex('chest-supported-dumbbell-row', 'Chest-Supported Dumbbell Row', 'Remada apoiada com halteres', 'dumbbell', 'compound', ['biceps']),
  ex('seated-cable-row', 'Seated Cable Row', 'Remada baixa', 'cable', 'compound', ['biceps'], ['Remada na polia']),
  ex('single-arm-cable-row', 'Single-Arm Cable Row', 'Remada unilateral na polia', 'cable', 'compound', ['biceps']),
  ex('t-bar-row', 'T-Bar Row', 'Remada cavalinho', 'barbell', 'compound', ['biceps'], ['Cavalinho']),
  ex('landmine-row', 'Landmine Row', 'Remada landmine', 'barbell', 'compound', ['biceps']),
  ex('machine-row', 'Seated Row Machine', 'Remada sentada na máquina', 'machine', 'compound', ['biceps']),
  ex('iso-lateral-row', 'Iso-Lateral Row', 'Remada iso-lateral na máquina', 'machine', 'compound', ['biceps']),
  ex('smith-row', 'Smith Bent-Over Row', 'Remada curvada no Smith', 'smith', 'compound', ['biceps', 'lowerBack']),
  ex('kettlebell-row', 'Kettlebell Row', 'Remada com kettlebell', 'kettlebell', 'compound', ['biceps']),
  ex('inverted-row', 'Inverted Row', 'Remada invertida', 'bodyweight', 'compound', ['biceps']),
  ex('cable-pullover', 'Cable Pullover', 'Pullover na polia', 'cable', 'isolation'),
  ex('band-pulldown', 'Band Pulldown', 'Pulldown com elástico', 'band', 'compound', ['biceps']),
  ex('machine-lat-pulldown', 'Machine Lat Pulldown', 'Puxada alta na máquina', 'machine', 'compound', ['biceps']),
]);
