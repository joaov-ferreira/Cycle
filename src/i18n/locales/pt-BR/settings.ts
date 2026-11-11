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
