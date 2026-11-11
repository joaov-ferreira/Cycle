import type { progress as enProgress } from '../en/progress';

/** Brazilian Portuguese `progress` namespace, typed against the English source. */
export const progress: typeof enProgress = {
  title: 'Progresso',
  empty: {
    title: 'Registre um treino para ver seu progresso',
  },
  tabs: {
    group: 'Seção do progresso',
    exercises: 'Exercícios',
    volume: 'Volume',
    calendar: 'Calendário',
    strength: 'Força',
  },
  exerciseGroup: 'Exercício',
  periodGroup: 'Período',
  metricGroup: 'Métrica',
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
  metrics: {
    e1rm: 'e1RM',
    e1rmEstimate: 'e1RM (estimativa)',
    topWeight: 'Carga máxima',
    volume: 'Volume',
    reps: 'Repetições',
  },
  units: {
    reps: 'reps',
  },
  details: 'Detalhes do exercício',
  personalRecords: {
    title: 'Recordes pessoais',
    weightValue: '{{weight}} × {{reps}}',
    e1rmValue: 'e1RM ≈ {{value}} (estimativa)',
    rowLabel: '{{value}}, {{date}}',
    empty: 'Nenhum recorde ainda.',
  },
  weeklyVolume: {
    title: 'Séries por grupo muscular',
    thisWeek: 'Esta semana',
    lastWeek: 'Semana passada',
    rowLabel: {
      one: '{{muscle}}: {{current}} série esta semana, {{previous}} na semana passada',
      other: '{{muscle}}: {{current}} séries esta semana, {{previous}} na semana passada',
    },
    empty: 'Nenhuma série registrada nestas duas semanas.',
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
