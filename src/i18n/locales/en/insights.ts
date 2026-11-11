/** English `insights` namespace (source catalog): Progress → Volume and Calendar (SPEC-v3 §10). */
export const insights = {
  volume: {
    title: 'Last 8 weeks',
    metricGroup: 'Metric',
    muscleGroup: 'Muscle group',
    metrics: {
      sessions: 'Sessions',
      volume: 'Volume (kg)',
      sets: 'Sets per muscle',
    },
    barSessions: {
      one: 'Week of {{date}}: {{count}} session',
      other: 'Week of {{date}}: {{count}} sessions',
    },
    barVolume: 'Week of {{date}}: {{value}}',
    barSets: {
      one: 'Week of {{date}}: {{count}} set of {{muscle}}',
      other: 'Week of {{date}}: {{count}} sets of {{muscle}}',
    },
    average: '8-week average: {{value}}',
    empty: 'No workouts in the last 8 weeks.',
  },
  calendar: {
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    streak: {
      one: '{{count}} week in a row',
      other: '{{count}} weeks in a row',
    },
    monthCount: {
      one: 'This month: {{count}} workout',
      other: 'This month: {{count}} workouts',
    },
    day: {
      one: '{{date}}: {{count}} workout',
      other: '{{date}}: {{count}} workouts',
    },
    dayDeload: {
      one: '{{date}}: {{count}} workout, deload',
      other: '{{date}}: {{count}} workouts, deload',
    },
    today: '{{date}}, today',
  },
};
