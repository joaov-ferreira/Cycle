import type { Exercise } from '../../domain/exercise';
import { ex, primary } from './define';

export const BICEPS_EXERCISES: readonly Exercise[] = primary('biceps', [
  ex('barbell-curl', 'Barbell Curl', 'Rosca direta com barra', 'barbell', 'isolation', ['forearms'], ['Rosca direta']),
  ex('dumbbell-curl', 'Dumbbell Curl', 'Rosca direta com halteres', 'dumbbell', 'isolation', ['forearms']),
  ex('hammer-curl', 'Hammer Curl', 'Rosca martelo', 'dumbbell', 'isolation', ['forearms']),
  ex('incline-dumbbell-curl', 'Incline Dumbbell Curl', 'Rosca inclinada com halteres', 'dumbbell', 'isolation'),
  ex('alternating-dumbbell-curl', 'Alternating Dumbbell Curl', 'Rosca alternada com halteres', 'dumbbell', 'isolation'),
  ex('concentration-curl', 'Concentration Curl', 'Rosca concentrada', 'dumbbell', 'isolation'),
  ex('zottman-curl', 'Zottman Curl', 'Rosca Zottman', 'dumbbell', 'isolation', ['forearms']),
  ex('barbell-preacher-curl', 'Barbell Preacher Curl', 'Rosca scott com barra', 'barbell', 'isolation', [], ['Rosca scott']),
  ex('machine-preacher-curl', 'Preacher Curl Machine', 'Rosca scott na máquina', 'machine', 'isolation'),
  ex('machine-biceps-curl', 'Biceps Curl Machine', 'Rosca na máquina', 'machine', 'isolation'),
  ex('cable-curl', 'Cable Curl', 'Rosca na polia', 'cable', 'isolation'),
  ex('barbell-21s-curl', '21s Barbell Curl', 'Rosca 21 com barra', 'barbell', 'isolation', [], ['Rosca 21']),
  ex('band-curl', 'Band Curl', 'Rosca com elástico', 'band', 'isolation'),
]);
