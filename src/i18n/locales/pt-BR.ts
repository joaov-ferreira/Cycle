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
  programs: {
    title: 'Programas',
    back: 'Voltar',
    intro: 'Os programas originais do banco de dados, com suas fontes. Nada aqui é calculado a partir dos seus 1RMs.',
    open: 'Abrir {{name}}',
    version: 'Versão: {{version}}',
    duration: {
      one: '{{count}} semana',
      other: '{{count}} semanas',
    },
    frequency: {
      one: '{{count}} sessão por semana',
      other: '{{count}} sessões por semana',
    },
    verification: {
      verified: 'Verificado',
      partial: 'Parcialmente verificado',
      unverified: 'Dados não verificados',
    },
    detail: {
      lifts: 'Exercícios: {{lifts}}',
      liftChoice: 'Você escolhe o exercício ao usar este programa.',
      source: 'Fonte',
      author: 'Autor: {{author}}',
      reference: 'Referência: {{reference}}',
      url: 'Link: {{url}}',
      accessed: 'Acessado em: {{date}}',
      notes: 'Observações: {{notes}}',
      structure: 'Estrutura original',
      week: 'Semana {{week}}',
      day: 'Dia {{day}}',
      selectedLift: 'Exercício escolhido',
      accessory: 'Acessório: {{name}} — {{text}}',
    },
    set: '{{sets}} × {{reps}} @ {{percent}}',
    amrap: 'o máximo de repetições na última série',
    notFound: 'Este programa não existe.',
    unverifiedSet: 'Dados não verificados',
    config: {
      title: 'Seus percentuais',
      description: 'Defina o percentual do seu 1RM para cada semana, de {{min}} a {{max}}, em passos de {{step}}.',
      unit: '%',
      reset: 'Restaurar percentuais padrão',
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
    rounding: {
      title: 'Incrementos e arredondamento',
      description: 'As cargas calculadas são arredondadas para o incremento que você consegue carregar.',
      mode: {
        label: 'Modo de arredondamento',
        nearest: 'Mais próximo',
        down: 'Sempre para baixo',
        up: 'Sempre para cima',
        hint: 'Valores no meio arredondam para baixo, então uma carga nunca fica acima do percentual.',
      },
      defaultIncrement: 'Incremento padrão',
      custom: 'Outro',
      customField: '{{label}} (personalizado)',
      preview: 'Exemplo: {{exact}} → {{rounded}}',
      lifts: {
        source: 'Origem do incremento de {{lift}}',
        inherit: 'Usar padrão',
        own: 'Próprio',
        incrementLabel: 'Incremento de {{lift}}',
      },
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
    notMultipleOfStep: 'Use múltiplos de {{step}}',
  },
};
