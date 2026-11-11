import type { picker as enPicker } from '../en/picker';

/** Brazilian Portuguese `picker` namespace, typed against the English source. */
export const picker: typeof enPicker = {
  searchLabel: 'Buscar exercícios',
  muscleFilter: 'Grupo muscular',
  equipmentFilter: 'Equipamento',
  suggestions: 'Sugestões',
  results: 'Exercícios',
  rowSubtitle: '{{muscle}} · {{equipment}}',
  emptyTitle: 'Nenhum exercício encontrado',
  emptyMessage: 'Tente outra busca ou filtro.',
  createExercise: 'Criar “{{name}}”',
  createNew: 'Novo exercício',
  createSubmit: 'Criar exercício',
  formName: 'Nome',
  formPrimaryMuscle: 'Grupo muscular principal',
  formEquipment: 'Equipamento',
  formMechanics: 'Tipo',
  formSecondaryMuscles: 'Grupos musculares secundários',
};
