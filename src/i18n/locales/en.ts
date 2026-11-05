/**
 * English UI catalog — the SOURCE catalog. Every other locale is typed against it, so a
 * missing or extra key in another catalog is a type error (see README "Internationalization").
 *
 * Plural messages are objects with exactly `one` and `other`; `{{name}}` is a placeholder.
 */
export const en = {
  app: {
    name: 'CYCLE',
    loading: 'Loading…',
    startupError: 'Could not open the local database.',
  },
  tabs: {
    dashboard: 'Dashboard',
    periodization: 'Periodization',
    training: 'Training',
    progress: 'Progress',
    more: 'More',
  },
  navigation: {
    label: 'Main navigation',
    tabHint: 'Opens the {{section}} section',
  },
  screens: {
    dashboard: {
      title: 'Dashboard',
      placeholder: 'Your current block, next session and latest estimates will appear here.',
    },
    periodization: {
      title: 'Periodization',
      placeholder: 'Configure your weekly sessions and generate a three-week periodization.',
    },
    training: {
      title: 'Training',
      placeholder: 'Log the sets you actually performed, with RIR and RPE.',
    },
    progress: {
      title: 'Progress',
      placeholder: 'Track your estimated 1RM over time for each lift.',
    },
    more: {
      title: 'More',
      programs: 'Programs',
      programsDescription: 'Browse the program database and its sources.',
      history: 'History',
      historyDescription: 'Review completed training sessions.',
      settings: 'Settings',
      settingsDescription: 'Profiles, 1RMs, increments and language.',
    },
  },
  common: {
    comingSoon: 'Coming soon',
  },
  lifts: {
    bench: 'Bench Press',
    squat: 'Squat',
    deadlift: 'Deadlift',
  },
  oneRm: {
    fieldLabel: '{{lift}} 1RM',
    unitHint: 'Leave a lift empty if you do not train it.',
    current: 'Current: {{value}}',
    notSet: 'Not set',
    history: 'History',
    noHistory: 'No records yet',
    historyEntry: '{{date}}: {{value}} ({{origin}})',
    origin: {
      manual: 'Manual',
      from_e1rm: 'From e1RM',
      onboarding: 'Onboarding',
    },
    save: 'Save 1RMs',
    saved: {
      one: '{{count}} 1RM saved',
      other: '{{count}} 1RMs saved',
    },
    nothingChanged: 'No changes to save',
  },
  onboarding: {
    title: 'Welcome to CYCLE',
    intro:
      'Enter your current one-rep max for each lift. Every load in your programs is calculated from these values. You can change them anytime in Settings.',
    start: 'Save and continue',
    skip: 'Skip for now',
  },
  settings: {
    title: 'Settings',
    back: 'Back',
    profiles: {
      title: 'Profile',
      select: 'Switch profile',
      active: 'Active',
      renameLabel: 'Profile name',
      rename: 'Rename profile',
      newLabel: 'New profile name',
      add: 'Add profile',
    },
    oneRms: {
      title: '1RMs',
      description: 'Each change adds a new record; previous values are kept in the history.',
    },
    language: {
      title: 'Language',
      label: 'App language',
      system: 'System',
      en: 'English',
      ptBR: 'Português',
    },
  },
  profile: {
    defaultName: 'Default',
  },
  validation: {
    required: 'Required',
    invalidNumber: 'Enter a valid number',
    belowMin: 'Must be at least {{min}}',
    notAboveMin: 'Must be greater than {{min}}',
    aboveMax: 'Must be at most {{max}}',
    tooLong: 'Use at most {{max}} characters',
    tooManyDecimals: {
      one: 'Use at most {{count}} decimal place',
      other: 'Use at most {{count}} decimal places',
    },
  },
};

export type Catalog = typeof en;
