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
