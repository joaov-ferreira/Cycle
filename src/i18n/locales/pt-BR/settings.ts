import type { settings as enSettings } from '../en/settings';

/** Brazilian Portuguese `settings` namespace, typed against the English source. */
export const settings: typeof enSettings = {
  title: 'Configurações',
  profiles: {
    title: 'Perfil',
    select: 'Trocar de perfil',
    active: 'Ativo',
    renameLabel: 'Nome do perfil',
    rename: 'Renomear perfil',
    newLabel: 'Nome do novo perfil',
    add: 'Adicionar perfil',
  },
  experience: {
    title: 'Experiência',
    label: 'Nível de experiência',
    beginner: 'Iniciante',
    intermediate: 'Intermediário',
    advanced: 'Avançado',
    hint: 'Define o ciclo sugerido: {{loadWeeks}} semanas de carga + {{deloadWeeks}} de deload.',
  },
  tools: {
    title: 'Ferramentas de treino',
    rest: 'Descanso padrão entre séries',
    restOff: 'Desligado',
    restNotifications: 'Notificações de descanso',
    restNotificationsHint: 'Uma notificação quando o descanso termina com o app em segundo plano.',
    keepAwake: 'Manter a tela ligada',
    keepAwakeHint: 'Enquanto um treino está em andamento na aba Treino.',
    bar: 'Peso da barra',
    plates: 'Anilhas disponíveis',
    errors: {
      rest: 'O descanso deve ficar entre 0 e 10 minutos.',
      bar: 'O peso da barra deve ficar entre 0 e 50 kg.',
      plates: 'Escolha ao menos uma anilha.',
    },
  },
  strength: {
    title: 'Força',
    focus: {
      label: 'Foco do treino',
      general: { label: 'Treino geral', description: 'Músculo, saúde e condicionamento.' },
      strength: { label: 'Força', description: 'Powerlifting e programas em porcentagem.' },
    },
    formula: {
      label: 'Fórmula de estimativa do 1RM',
      epley: { label: 'Epley', description: 'A padrão. Carga × (1 + repetições ÷ 30), contando as repetições na reserva como repetições.' },
      brzycki: { label: 'Brzycki', description: 'Carga × 36 ÷ (37 − repetições). Mais conservadora que a Epley até cerca de 10 repetições.' },
      rts: { label: 'RTS', description: 'Tabela de repetições e RPE da Reactive Training Systems; Epley fora da tabela.' },
    },
    effort: {
      label: 'Escala de esforço',
      rir: 'RIR',
      rpe: 'RPE',
      hint: 'O RIR conta as repetições na reserva; o RPE avalia o esforço de 1 a 10. Ambos aceitam meio ponto.',
    },
    rounding: {
      label: 'Arredondamento das cargas calculadas',
      nearest: { label: 'Mais próximo', description: 'Arredonda para o incremento mais próximo; em caso de empate, para baixo.' },
      down: { label: 'Sempre para baixo', description: 'Nunca acima da carga calculada.' },
      up: { label: 'Sempre para cima', description: 'Nunca abaixo da carga calculada.' },
    },
    openMaxes: 'Abrir 1RMs',
    error: 'Não foi possível salvar a configuração. Tente novamente.',
  },
  notification: {
    title: 'Descanso terminado',
    body: 'Próximo: {{exercise}} — série {{set}}',
  },
  theme: {
    title: 'Tema',
    label: 'Tema do app',
    dark: 'Escuro',
    light: 'Claro',
  },
  language: {
    title: 'Idioma',
    label: 'Idioma do app',
    system: 'Sistema',
    en: 'English',
    ptBR: 'Português',
  },
};
