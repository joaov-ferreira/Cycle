import type { timer as enTimer } from '../en/timer';

/** Brazilian Portuguese `timer` namespace, typed against the English source. */
export const timer: typeof enTimer = {
  rest: 'Descanso',
  restAccessible: 'Descanso: {{time}}',
  minutes: { one: '{{count}} minuto', other: '{{count}} minutos' },
  seconds: { one: '{{count}} segundo', other: '{{count}} segundos' },
  over: 'Descanso terminado',
  minus15: '−15 s',
  plus15: '+15 s',
  minus15Accessible: 'Reduzir o descanso em 15 segundos',
  plus15Accessible: 'Aumentar o descanso em 15 segundos',
  skip: 'Pular',
  skipAccessible: 'Pular o descanso',
};
