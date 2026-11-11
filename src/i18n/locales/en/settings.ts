/** English `settings` namespace (source catalog). */
export const settings = {
  title: 'Settings',
  profiles: {
    title: 'Profile',
    select: 'Switch profile',
    active: 'Active',
    renameLabel: 'Profile name',
    rename: 'Rename profile',
    newLabel: 'New profile name',
    add: 'Add profile',
  },
  experience: {
    title: 'Experience',
    label: 'Experience level',
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    hint: 'Sets the suggested cycle: {{loadWeeks}} load weeks + {{deloadWeeks}} deload.',
  },
  tools: {
    title: 'Workout tools',
    rest: 'Default rest between sets',
    restOff: 'Off',
    restNotifications: 'Rest notifications',
    restNotificationsHint: 'A notification when a rest ends while the app is in the background.',
    keepAwake: 'Keep screen on',
    keepAwakeHint: 'While a workout is in progress on the Workout tab.',
    bar: 'Bar weight',
    plates: 'Available plates',
    errors: {
      rest: 'Rest must be between 0 and 10 minutes.',
      bar: 'Bar weight must be between 0 and 50 kg.',
      plates: 'Choose at least one plate.',
    },
  },
  notification: {
    title: 'Rest over',
    body: 'Next: {{exercise}} — set {{set}}',
  },
  theme: {
    title: 'Theme',
    label: 'App theme',
    dark: 'Dark',
    light: 'Light',
  },
  language: {
    title: 'Language',
    label: 'App language',
    system: 'System',
    en: 'English',
    ptBR: 'Português',
  },
};
