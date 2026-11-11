import type { validation as enValidation } from '../en/validation';

/** Brazilian Portuguese `validation` namespace, typed against the English source. */
export const validation: typeof enValidation = {
  required: 'Obrigatório',
  invalidNumber: 'Digite um número válido',
  belowMin: 'Deve ser no mínimo {{min}}',
  notAboveMin: 'Deve ser maior que {{min}}',
  aboveMax: 'Deve ser no máximo {{max}}',
  tooLong: 'Use no máximo {{max}} caracteres',
  tooManyDecimals: {
    one: 'Use no máximo {{count}} casa decimal',
    other: 'Use no máximo {{count}} casas decimais',
  },
  notMultipleOfStep: 'Use múltiplos de {{step}}',
};
