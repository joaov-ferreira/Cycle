import type { tools as enTools } from '../en/tools';

/** Brazilian Portuguese `tools` namespace, typed against the English source. */
export const tools: typeof enTools = {
  plates: 'Anilhas',
  platesTitle: 'Anilhas deste exercício',
  platesEmpty: 'Informe uma carga para ver as anilhas',
  platesPerSide: '{{weight}}: {{plates}} de cada lado',
  platesBarOnly: '{{weight}}: só a barra',
  platesBelowBar: '{{weight}}: abaixo do peso da barra',
  platesRemainder: '(não dá para montar {{weight}})',
  addWarmup: 'Adicionar aquecimento',
  warmupNeedsWeight: 'Informe antes a carga de trabalho',
  editNote: 'Editar nota do exercício',
  exerciseNote: 'Nota do exercício',
};
