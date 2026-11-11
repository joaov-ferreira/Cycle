import {
  NoActivePlanError,
  NoteValidationError,
  NothingLoggedError,
  PlanWorkoutNotFoundError,
  WorkoutInProgressError,
} from '@/state';
import { catalogs, type AppLocale } from '@/i18n';
import { translate } from '@/i18n/translate';

import { actionErrorMessage } from './action-error';

const tFor = (locale: AppLocale) => (key: Parameters<typeof translate<typeof catalogs.en>>[2], params?: Record<string, string | number>) =>
  translate(catalogs[locale], locale, key, params);

describe('actionErrorMessage', () => {
  it.each([
    [new NoteValidationError('tooLong'), 'Use at most 500 characters', 'Use no máximo 500 caracteres'],
    [new NothingLoggedError(), 'Mark at least one working set as done first.', 'Marque antes ao menos uma série de trabalho como feita.'],
    [new WorkoutInProgressError(), 'A workout is already in progress.', 'Já existe um treino em andamento.'],
    [new NoActivePlanError(), 'There is no active plan.', 'Não há periodização ativa.'],
    [new PlanWorkoutNotFoundError('w-x'), 'That workout is no longer in the plan.', 'Esse treino não está mais na periodização.'],
    [new Error('boom'), 'Something went wrong. Please try again.', 'Algo deu errado. Tente novamente.'],
    ['text', 'Something went wrong. Please try again.', 'Algo deu errado. Tente novamente.'],
    [null, 'Something went wrong. Please try again.', 'Algo deu errado. Tente novamente.'],
  ])('maps %p to a localized message', (error, en, ptBR) => {
    expect(actionErrorMessage(error, tFor('en'))).toBe(en);
    expect(actionErrorMessage(error, tFor('pt-BR'))).toBe(ptBR);
  });
});
