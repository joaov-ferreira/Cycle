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
