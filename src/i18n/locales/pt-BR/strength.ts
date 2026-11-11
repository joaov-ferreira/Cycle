import type { strength as enStrength } from '../en/strength';

/** Brazilian Portuguese `strength` namespace, typed against the English source. */
export const strength: typeof enStrength = {
  empty: {
    title: 'Nenhum 1RM ainda',
    message: 'Defina o 1RM dos seus principais exercícios para acompanhar sua força aqui.',
    action: 'Definir 1RMs',
  },
  card: {
    open: 'Abrir detalhes do 1RM de {{name}}',
    reference: '1RM de referência: {{kg}} · {{date}} · {{origin}}',
    latest: 'Último e1RM',
    previous: 'e1RM anterior',
    best: 'Melhor e1RM',
    estimate: '{{kg}} · {{date}}',
    delta: 'Variação vs. anterior: {{kg}} ({{percent}})',
    improvement: 'Em {{period}}: {{kg}} ({{percent}}) a partir de {{baseline}}',
    noEstimate: 'Nenhuma estimativa de força ainda em {{period}}.',
  },
  chart: {
    estimates: 'e1RM de força',
    references: '1RM de referência',
  },
  percent: '{{value}} %',
  source: {
    program: '{{program}} · semana {{week}} · dia {{day}}',
    scheme: 'Percentual do 1RM · semana {{week}}',
  },
  prescription: {
    group: '{{sets}}×{{reps}} @ {{load}}',
    amrapGroup: '{{sets}}×{{reps}}+ @ {{load}}',
    noLoad: '—',
  },
};
