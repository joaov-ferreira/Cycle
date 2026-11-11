import type { aiReview as en } from '../en/aiReview';

/** Brazilian Portuguese `aiReview` namespace, typed against the English source. */
export const aiReview: typeof en = {
  title: 'Revisar com IA',
  back: 'Voltar',
  intro: 'Peça a um assistente de IA para revisar seus resultados e sugerir uma periodização ajustada.',
  step1: '1. Copie ou compartilhe o prompt abaixo.',
  step2: '2. Cole no ChatGPT, Claude, Gemini ou qualquer assistente.',
  step3: '3. Copie a resposta em JSON.',
  step4: '4. Volte aqui e importe, escolhendo “Atualizar periodização”.',
  notesLabel: 'Como você se sente? Dor, fadiga, mudanças de agenda…',
  promptLabel: 'Prompt para o assistente',
  share: 'Compartilhar',
  shareHint: 'Se o compartilhamento não estiver disponível, selecione o texto e copie.',
  importAnswer: 'Importar a resposta',
  notFoundTitle: 'Periodização não encontrada',
  notFoundMessage: 'Esta periodização não existe mais.',
};
