import type { cycleReport as en } from '../en/cycleReport';

/** Brazilian Portuguese `cycleReport` namespace, typed against the English source. */
export const cycleReport: typeof en = {
  title: 'Relatório do ciclo {{cycle}}',
  back: 'Voltar',
  period: '{{from}} – {{to}}',
  sessionsLabel: 'Sessões',
  sessions: '{{done}} de {{planned}}',
  adherenceLabel: 'Aderência',
  percent: '{{value}} %',
  volumeLabel: 'Volume total',
  exercisesTitle: 'Exercícios',
  exerciseSessions: { one: '{{count}} sessão', other: '{{count}} sessões' },
  openExercise: 'Abrir {{name}}',
  loadRange: '{{from}} → {{to}}',
  noLoad: '—',
  stalled: 'Estagnado',
  records: { one: '{{count}} recorde', other: '{{count}} recordes' },
  musclesTitle: 'Séries semanais médias por grupo muscular',
  muscleSets: '{{muscle}}: {{sets}}',
  reviewWithAi: 'Revisar com IA',
  emptyTitle: 'Nenhum treino neste ciclo',
  emptyMessage: 'Conclua um treino desta periodização neste ciclo para ver o relatório.',
  notFoundTitle: 'Periodização não encontrada',
  notFoundMessage: 'Esta periodização não existe mais.',
};
