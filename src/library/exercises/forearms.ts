import type { Exercise } from '../../domain/exercise';
import { ex, primary } from './define';

export const FOREARMS_EXERCISES: readonly Exercise[] = primary('forearms', [
  ex('barbell-wrist-curl', 'Barbell Wrist Curl', 'Flexão de punho com barra', 'barbell', 'isolation'),
  ex('barbell-reverse-wrist-curl', 'Barbell Reverse Wrist Curl', 'Extensão de punho com barra', 'barbell', 'isolation'),
  ex('dumbbell-wrist-curl', 'Dumbbell Wrist Curl', 'Flexão de punho com halteres', 'dumbbell', 'isolation'),
  ex('dumbbell-reverse-wrist-curl', 'Dumbbell Reverse Wrist Curl', 'Extensão de punho com halteres', 'dumbbell', 'isolation'),
  ex('barbell-reverse-curl', 'Barbell Reverse Curl', 'Rosca inversa com barra', 'barbell', 'isolation', ['biceps'], ['Rosca inversa']),
]);
