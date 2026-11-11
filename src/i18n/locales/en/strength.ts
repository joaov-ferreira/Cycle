/** English `strength` namespace (SPEC-v4): the Progress Strength tab and wording shared by Home, report and history. */
export const strength = {
  title: 'Strength',
  empty: {
    title: 'No 1RMs yet',
    message: 'Set a 1RM for your main lifts to follow your strength here.',
    action: 'Set 1RMs',
  },
  card: {
    open: 'Open 1RM details for {{name}}',
    reference: 'Reference 1RM: {{kg}} · {{date}} · {{origin}}',
    latest: 'Latest e1RM',
    previous: 'Previous e1RM',
    best: 'Best e1RM',
    estimate: '{{kg}} · {{date}}',
    delta: 'Change vs previous: {{kg}} ({{percent}})',
    improvement: 'Over {{period}}: {{kg}} ({{percent}}) from {{baseline}}',
    noEstimate: 'No strength estimate yet in {{period}}.',
  },
  chart: {
    estimates: 'Strength e1RM',
    references: 'Reference 1RM',
  },
  origin: {
    manual: 'Entered manually',
    fromE1rm: 'From a workout estimate',
    onboarding: 'Set at onboarding',
    import: 'Imported with a plan',
    v1: 'From the earlier version',
  },
  percent: '{{value}} %',
  source: {
    program: '{{program}} · week {{week}} · day {{day}}',
    scheme: 'Percent of 1RM · week {{week}}',
  },
  prescription: {
    group: '{{sets}}×{{reps}} @ {{load}}',
    amrapGroup: '{{sets}}×{{reps}}+ @ {{load}}',
    noLoad: '—',
  },
};
