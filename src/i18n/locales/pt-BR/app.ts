import type { app as enApp } from '../en/app';

/** Brazilian Portuguese `app` namespace, typed against the English source. */
export const app: typeof enApp = {
  name: 'CYCLE',
  loading: 'Carregando…',
  startupError: 'Não foi possível abrir o banco de dados local.',
};
