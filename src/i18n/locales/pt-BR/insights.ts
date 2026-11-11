import type { insights as en } from '../en/insights';

/** Brazilian Portuguese `insights` namespace, typed against the English source. */
export const insights: typeof en = {
  volume: {
    title: 'Últimas 8 semanas',
    metricGroup: 'Métrica',
    muscleGroup: 'Grupo muscular',
    metrics: {
      sessions: 'Sessões',
      volume: 'Volume (kg)',
      sets: 'Séries por músculo',
    },
    barSessions: {
      one: 'Semana de {{date}}: {{count}} sessão',
      other: 'Semana de {{date}}: {{count}} sessões',
    },
    barVolume: 'Semana de {{date}}: {{value}}',
    barSets: {
      one: 'Semana de {{date}}: {{count}} série de {{muscle}}',
      other: 'Semana de {{date}}: {{count}} séries de {{muscle}}',
    },
    average: 'Média de 8 semanas: {{value}}',
    empty: 'Nenhum treino nas últimas 8 semanas.',
  },
  calendar: {
    previousMonth: 'Mês anterior',
    nextMonth: 'Próximo mês',
    streak: {
      one: '{{count}} semana seguida',
      other: '{{count}} semanas seguidas',
    },
    monthCount: {
      one: 'Neste mês: {{count}} treino',
      other: 'Neste mês: {{count}} treinos',
    },
    day: {
      one: '{{date}}: {{count}} treino',
      other: '{{date}}: {{count}} treinos',
    },
    dayDeload: {
      one: '{{date}}: {{count}} treino, deload',
      other: '{{date}}: {{count}} treinos, deload',
    },
    today: '{{date}}, hoje',
  },
};
