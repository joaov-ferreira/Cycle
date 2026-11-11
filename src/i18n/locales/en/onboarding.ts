/** English `onboarding` namespace (source catalog). */
export const onboarding = {
  title: 'Welcome to CYCLE',
  intro: 'Tell us about your training experience. CYCLE uses it to suggest the load and deload cycle of your plans.',
  experience: {
    label: 'Experience level',
    beginner: {
      label: 'Beginner',
      description: 'New to lifting, or back after a long break.',
    },
    intermediate: {
      label: 'Intermediate',
      description: 'Training consistently for about a year or more.',
    },
    advanced: {
      label: 'Advanced',
      description: 'Years of consistent training with progressive overload.',
    },
    hint: 'Sets the suggested cycle: {{loadWeeks}} load weeks + {{deloadWeeks}} deload.',
  },
  focus: {
    title: 'What do you train for?',
  },
  lifts: {
    title: 'Your lifts',
    intro: 'Enter the 1RM of the lifts you train, or estimate it from a set. Empty rows are skipped; you can add them later.',
    kgLabel: '1RM of {{exercise}}',
    remove: 'Remove {{exercise}}',
    add: 'Add exercise',
    pickerTitle: 'Add a lift',
  },
  next: 'Continue',
  actions: {
    programs: 'Choose a strength program',
    template: 'Choose a template',
    import: 'Import a plan',
    later: 'Later',
  },
  error: 'Something went wrong. Try again.',
};
