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
    exercises: 'Exercises',
    automatic: '{{sets}}×{{min}}–{{max}}',
    automaticFixed: '{{sets}}×{{reps}}',
    restDay: 'Rest day',
    markRestDone: 'Mark rest day as done',
  },
  missingMaxes: {
    title: 'Missing 1RMs',
    message: 'These lifts need a 1RM to get loads: {{names}}',
    action: 'Set 1RMs',
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
  streak: {
    one: '{{count}} week in a row',
    other: '{{count}} weeks in a row',
  },
  cycleComplete: {
    title: 'Cycle {{number}} complete',
    report: 'See report',
    dismiss: 'Dismiss',
  },
  backup: {
    message: 'Your logbook has no recent backup',
    action: 'Back up now',
  },
  error: {
    generic: 'Something went wrong. Try again.',
    workoutInProgress: 'Finish or discard the workout in progress first.',
  },
};
