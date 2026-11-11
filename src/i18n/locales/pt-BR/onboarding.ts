import type { onboarding as enOnboarding } from '../en/onboarding';

/** Brazilian Portuguese `onboarding` namespace, typed against the English source. */
export const onboarding: typeof enOnboarding = {
  title: 'Bem-vindo ao CYCLE',
  intro: 'Conte-nos sobre sua experiência de treino. O CYCLE usa essa informação para sugerir o ciclo de carga e deload das suas periodizações.',
  experience: {
    label: 'Nível de experiência',
    beginner: {
      label: 'Iniciante',
      description: 'Começando a treinar com peso, ou voltando após uma longa pausa.',
    },
    intermediate: {
      label: 'Intermediário',
      description: 'Treinando com regularidade há cerca de um ano ou mais.',
    },
    advanced: {
      label: 'Avançado',
      description: 'Anos de treino regular com sobrecarga progressiva.',
    },
    hint: 'Define o ciclo sugerido: {{loadWeeks}} semanas de carga + {{deloadWeeks}} de deload.',
  },
  focus: {
    title: 'Para que você treina?',
  },
  lifts: {
    title: 'Seus levantamentos',
    intro: 'Informe o 1RM dos levantamentos que você treina, ou estime-o a partir de uma série. Linhas vazias são ignoradas; você pode preenchê-las depois.',
    kgLabel: '1RM de {{exercise}}',
    remove: 'Remover {{exercise}}',
    add: 'Adicionar exercício',
    pickerTitle: 'Adicionar um levantamento',
  },
  next: 'Continuar',
  actions: {
    programs: 'Escolher um programa de força',
    template: 'Escolher um modelo',
    import: 'Importar periodização',
    later: 'Depois',
  },
  error: 'Algo deu errado. Tente novamente.',
};
