import type { Catalog } from './en';

/** Brazilian Portuguese UI catalog, typed against the English source catalog. */
export const ptBR: Catalog = {
  app: {
    name: 'CYCLE',
    loading: 'Carregando…',
    startupError: 'Não foi possível abrir o banco de dados local.',
  },
  tabs: {
    dashboard: 'Painel',
    periodization: 'Periodização',
    training: 'Treino',
    progress: 'Progresso',
    more: 'Mais',
  },
  navigation: {
    label: 'Navegação principal',
    tabHint: 'Abre a seção {{section}}',
  },
  screens: {
    dashboard: {
      title: 'Painel',
      placeholder: 'Seu bloco atual, a próxima sessão e as estimativas mais recentes aparecerão aqui.',
    },
    periodization: {
      title: 'Periodização',
      placeholder: 'Configure suas sessões semanais e gere uma periodização de três semanas.',
    },
    training: {
      title: 'Treino',
      placeholder: 'Registre as séries realizadas, com RIR e RPE.',
    },
    progress: {
      title: 'Progresso',
      placeholder: 'Acompanhe seu 1RM estimado ao longo do tempo para cada levantamento.',
    },
    more: {
      title: 'Mais',
      programs: 'Programas',
      programsDescription: 'Consulte o banco de programas e suas fontes.',
      history: 'Histórico',
      historyDescription: 'Revise as sessões de treino concluídas.',
      settings: 'Configurações',
      settingsDescription: 'Perfis, 1RMs, incrementos e idioma.',
    },
  },
  common: {
    comingSoon: 'Em breve',
  },
  profile: {
    defaultName: 'Padrão',
  },
  validation: {
    required: 'Obrigatório',
    invalidNumber: 'Digite um número válido',
    belowMin: 'Deve ser no mínimo {{min}}',
    notAboveMin: 'Deve ser maior que {{min}}',
    aboveMax: 'Deve ser no máximo {{max}}',
    tooManyDecimals: {
      one: 'Use no máximo {{count}} casa decimal',
      other: 'Use no máximo {{count}} casas decimais',
    },
  },
};
