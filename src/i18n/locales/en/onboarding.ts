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
  actions: {
    template: 'Choose a template',
    import: 'Import a plan',
    later: 'Later',
  },
  error: 'Something went wrong. Try again.',
};
