import type { body as en } from '../en/body';

/** Brazilian Portuguese `body` namespace, typed against the English source. */
export const body: typeof en = {
  title: 'Corpo',
  kindGroup: 'Medida',
  kinds: {
    weight: 'Peso',
    bodyFat: 'Gordura corporal',
    waist: 'Cintura',
    chest: 'Peito',
    hips: 'Quadril',
    arm: 'Braço',
    thigh: 'Coxa',
    calf: 'Panturrilha',
  },
  periodGroup: 'Período do gráfico',
  periods: {
    '4w': '4 semanas',
    '3m': '3 meses',
    '6m': '6 meses',
    '1y': '1 ano',
    all: 'Tudo',
  },
  form: {
    newEntry: 'Novo registro',
    editEntry: 'Editar registro',
    date: 'Data (AAAA-MM-DD)',
    value: 'Valor',
  },
  errors: {
    date: {
      required: 'Informe a data',
      invalidDate: 'Use uma data válida no formato AAAA-MM-DD',
      inFuture: 'A data não pode estar no futuro',
    },
    value: {
      required: 'Informe o valor',
      outOfRange: 'Use de {{min}} a {{max}} {{unit}}',
      tooManyDecimals: 'Use no máximo 2 casas decimais',
    },
    save: 'Não foi possível salvar o registro',
    delete: 'Não foi possível excluir o registro',
  },
  stats: {
    latest: 'Mais recente',
    change: 'Variação',
    changeSince: '{{change}} desde {{date}}',
    weekMean: 'Média de 7 dias',
  },
  entries: {
    title: 'Registros',
    edit: 'Editar registro de {{date}}, {{value}}',
    delete: 'Excluir registro de {{date}}',
  },
  empty: {
    title: 'Nenhum registro ainda',
    message: 'Adicione a primeira medição de {{kind}} acima.',
  },
  confirmDelete: {
    title: 'Excluir este registro?',
    message: '{{date}}: {{value}} será removido.',
  },
};
