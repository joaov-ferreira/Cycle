import type { progress as enProgress } from '../en/progress';

/** Brazilian Portuguese `progress` namespace, typed against the English source. */
export const progress: typeof enProgress = {
  title: 'Progresso',
  periods: {
    '4w': '4 sem',
    '3m': '3 m',
    '6m': '6 m',
    '1y': '1 ano',
    all: 'Tudo',
  },
  periodNames: {
    '4w': 'as últimas 4 semanas',
    '3m': 'os últimos 3 meses',
    '6m': 'os últimos 6 meses',
    '1y': 'o último ano',
    all: 'todo o período',
  },
  chart: {
    label: 'Gráfico de {{label}}',
    summary: {
      one: '{{label}}, {{period}}: {{count}} ponto, o último de {{latest}} em {{date}}.',
      other: '{{label}}, {{period}}: {{count}} pontos, o último de {{latest}} em {{date}}.',
    },
    yAxis: 'kg',
    point: '{{date}}: {{value}}',
    tooltip: '{{date}} · {{value}}',
    hint: 'Toque ou passe o mouse sobre um ponto para ver a data e o valor.',
    empty: 'Ainda não há dados de {{label}}.',
    emptyPeriod: 'Sem dados de {{label}} em {{period}}.',
  },
};
