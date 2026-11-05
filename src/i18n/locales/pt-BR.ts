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
  lifts: {
    bench: 'Supino',
    squat: 'Agachamento',
    deadlift: 'Levantamento Terra',
  },
  oneRm: {
    fieldLabel: '1RM de {{lift}}',
    unitHint: 'Deixe o levantamento vazio se você não o treina.',
    current: 'Atual: {{value}}',
    notSet: 'Não definido',
    history: 'Histórico',
    noHistory: 'Nenhum registro ainda',
    historyEntry: '{{date}}: {{value}} ({{origin}})',
    origin: {
      manual: 'Manual',
      from_e1rm: 'A partir do e1RM',
      onboarding: 'Primeiro acesso',
    },
    save: 'Salvar 1RMs',
    saved: {
      one: '{{count}} 1RM salvo',
      other: '{{count}} 1RMs salvos',
    },
    nothingChanged: 'Nenhuma alteração para salvar',
  },
  onboarding: {
    title: 'Bem-vindo ao CYCLE',
    intro:
      'Informe seu 1RM atual de cada levantamento. Todas as cargas dos programas são calculadas a partir desses valores. Você pode alterá-los a qualquer momento em Configurações.',
    start: 'Salvar e continuar',
    skip: 'Pular por enquanto',
  },
  settings: {
    title: 'Configurações',
    back: 'Voltar',
    profiles: {
      title: 'Perfil',
      select: 'Trocar de perfil',
      active: 'Ativo',
      renameLabel: 'Nome do perfil',
      rename: 'Renomear perfil',
      newLabel: 'Nome do novo perfil',
      add: 'Adicionar perfil',
    },
    oneRms: {
      title: '1RMs',
      description: 'Cada alteração cria um novo registro; os valores anteriores ficam no histórico.',
    },
    language: {
      title: 'Idioma',
      label: 'Idioma do app',
      system: 'Sistema',
      en: 'English',
      ptBR: 'Português',
    },
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
    tooLong: 'Use no máximo {{max}} caracteres',
    tooManyDecimals: {
      one: 'Use no máximo {{count}} casa decimal',
      other: 'Use no máximo {{count}} casas decimais',
    },
  },
};
