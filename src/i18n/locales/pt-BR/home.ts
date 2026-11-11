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
  cycle: {
    load: 'Ciclo {{cycle}} · Semana de carga {{week}} de {{total}}',
    deload: 'Ciclo {{cycle}} · Semana de deload {{week}} de {{total}}',
    sessions: 'Sessões nesta semana: {{done}}/{{total}}',
  },
  advice: {
    upcoming: 'O deload começa depois desta semana.',
    inDeload: 'Semana de deload: menos séries e cargas mais leves.',
    early: {
      one: 'O progresso estagnou em {{count}} exercício. Um deload pode ajudar.',
      other: 'O progresso estagnou em {{count}} exercícios. Um deload pode ajudar.',
    },
    startDeload: 'Iniciar deload agora',
    dismiss: 'Dispensar',
    endDeload: 'Encerrar deload',
    endDeloadTitle: 'Encerrar deload?',
    endDeloadMessage: 'O próximo treino inicia o ciclo {{cycle}}, semana de carga 1.',
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
  error: {
    generic: 'Algo deu errado. Tente novamente.',
    workoutInProgress: 'Conclua ou descarte o treino em andamento primeiro.',
  },
};
