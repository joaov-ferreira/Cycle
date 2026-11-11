/** English `progress` namespace (source catalog). */
export const progress = {
  title: 'Progress',
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
