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
  actions: {
    template: 'Escolher um modelo',
    import: 'Importar periodização',
    later: 'Depois',
  },
  error: 'Algo deu errado. Tente novamente.',
};
