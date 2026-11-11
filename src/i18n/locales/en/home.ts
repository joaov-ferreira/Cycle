/** English `home` namespace (source catalog). */
export const home = {
  title: 'Home',
  freeWorkout: 'Free workout',
  openPlan: 'Open plan',
  resume: {
    title: 'Resume workout',
    started: 'Started {{time}}',
  },
  next: {
    title: 'Next workout',
    deload: 'Deload',
    start: 'Start',
  },
  cycle: {
    load: 'Cycle {{cycle}} · Load week {{week}} of {{total}}',
    deload: 'Cycle {{cycle}} · Deload week {{week}} of {{total}}',
    sessions: 'Sessions this week: {{done}}/{{total}}',
  },
  advice: {
    upcoming: 'Deload starts after this week.',
    inDeload: 'Deload week: fewer sets and lighter loads.',
    early: {
      one: 'Progress has stalled on {{count}} exercise. A deload may help.',
      other: 'Progress has stalled on {{count}} exercises. A deload may help.',
    },
    startDeload: 'Start deload now',
    dismiss: 'Dismiss',
    endDeload: 'End deload',
    endDeloadTitle: 'End deload?',
    endDeloadMessage: 'The next workout starts cycle {{cycle}}, load week 1.',
  },
  noPlan: {
    title: 'No active plan',
    message: 'Create a plan for suggested loads and load/deload cycles, or log a free workout.',
    template: 'Choose a template',
    import: 'Import a plan',
    scratch: 'Start from scratch',
  },
  recent: {
    title: 'Recent workouts',
    sets: {
      one: '{{count}} working set',
      other: '{{count}} working sets',
    },
    summary: '{{sets}} · {{volume}}',
  },
  error: {
    generic: 'Something went wrong. Try again.',
    workoutInProgress: 'Finish or discard the workout in progress first.',
  },
};
