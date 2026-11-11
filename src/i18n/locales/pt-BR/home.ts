import type { home as enHome } from '../en/home';

/** Brazilian Portuguese `home` namespace, typed against the English source. */
export const home: typeof enHome = {
  title: 'Início',
  freeWorkout: 'Treino livre',
  openPlan: 'Abrir periodização',
  resume: {
    title: 'Retomar treino',
    started: 'Iniciado às {{time}}',
  },
  next: {
    title: 'Próximo treino',
    deload: 'Deload',
    start: 'Iniciar',
    exercises: 'Exercícios',
    automatic: '{{sets}}×{{min}}–{{max}}',
    automaticFixed: '{{sets}}×{{reps}}',
    restDay: 'Dia de descanso',
    markRestDone: 'Marcar dia de descanso como concluído',
  },
  missingMaxes: {
    title: '1RMs em falta',
    message: 'Estes exercícios precisam de um 1RM para ter cargas: {{names}}',
    action: 'Definir 1RMs',
  },
  noPlan: {
    title: 'Nenhuma periodização ativa',
    message: 'Crie uma periodização para ter cargas sugeridas e ciclos de carga e deload, ou registre um treino livre.',
    template: 'Escolher um modelo',
    import: 'Importar periodização',
    scratch: 'Começar do zero',
  },
  recent: {
    title: 'Treinos recentes',
    sets: {
      one: '{{count}} série de trabalho',
      other: '{{count}} séries de trabalho',
    },
    summary: '{{sets}} · {{volume}}',
  },
  streak: {
    one: '{{count}} semana seguida',
    other: '{{count}} semanas seguidas',
  },
  cycleComplete: {
    title: 'Ciclo {{number}} concluído',
    report: 'Ver relatório',
    dismiss: 'Dispensar',
  },
  backup: {
    message: 'Seu diário não tem backup recente',
    action: 'Fazer backup agora',
  },
  error: {
    generic: 'Algo deu errado. Tente novamente.',
    workoutInProgress: 'Conclua ou descarte o treino em andamento primeiro.',
  },
};
