/** English `progress` namespace (source catalog). */
export const progress = {
  title: 'Progress',
  empty: {
    title: 'Log a workout to see your progress',
  },
  tabs: {
    group: 'Progress section',
    exercises: 'Exercises',
    volume: 'Volume',
    calendar: 'Calendar',
  },
  exerciseGroup: 'Exercise',
  periodGroup: 'Period',
  metricGroup: 'Metric',
  periods: {
    '4w': '4 wks',
    '3m': '3 mo',
    '6m': '6 mo',
    '1y': '1 yr',
    all: 'All',
  },
  periodNames: {
    '4w': 'the last 4 weeks',
    '3m': 'the last 3 months',
    '6m': 'the last 6 months',
    '1y': 'the last year',
    all: 'all time',
  },
  metrics: {
    e1rm: 'e1RM',
    e1rmEstimate: 'e1RM (estimate)',
    topWeight: 'Top weight',
    volume: 'Volume',
    reps: 'Reps',
  },
  units: {
    reps: 'reps',
  },
  details: 'Exercise details',
  personalRecords: {
    title: 'Personal records',
    weightValue: '{{weight}} × {{reps}}',
    e1rmValue: 'e1RM ≈ {{value}} (estimate)',
    rowLabel: '{{value}}, {{date}}',
    empty: 'No records yet.',
  },
  weeklyVolume: {
    title: 'Sets per muscle group',
    thisWeek: 'This week',
    lastWeek: 'Last week',
    rowLabel: {
      one: '{{muscle}}: {{current}} set this week, {{previous}} last week',
      other: '{{muscle}}: {{current}} sets this week, {{previous}} last week',
    },
    empty: 'No sets logged in these two weeks.',
  },
  chart: {
    label: '{{label}} chart',
    summary: {
      one: '{{label}}, {{period}}: {{count}} data point, latest {{latest}} on {{date}}.',
      other: '{{label}}, {{period}}: {{count}} data points, latest {{latest}} on {{date}}.',
    },
    yAxis: 'kg',
    point: '{{date}}: {{value}}',
    tooltip: '{{date}} · {{value}}',
    hint: 'Tap or hover a point to see its date and value.',
    empty: 'No data yet for {{label}}.',
    emptyPeriod: 'No data for {{label}} in {{period}}.',
  },
};
