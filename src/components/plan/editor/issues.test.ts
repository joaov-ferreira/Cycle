import { catalogs, translate, type AppLocale, type MessageKey, type TranslationParams } from '@/i18n';
import type { PlanIssueCode } from '@/domain/plan';

import { issueMessage, parseIssuePath } from './issues';

const tFor =
  (locale: AppLocale) =>
  (key: MessageKey, params?: TranslationParams) =>
    translate(catalogs[locale], locale, key, params);

const message = (locale: AppLocale, path: string, code: PlanIssueCode) =>
  issueMessage(tFor(locale), (n) => String(n), { path, code });

describe('parseIssuePath', () => {
  it('maps paths to the plan, a workout or an exercise', () => {
    expect(parseIssuePath('name')).toEqual({ kind: 'plan', field: 'name' });
    expect(parseIssuePath('workouts')).toEqual({ kind: 'plan', field: 'workouts' });
    expect(parseIssuePath('workouts[1].name')).toEqual({ kind: 'workout', workoutIndex: 1, field: 'name' });
    expect(parseIssuePath('workouts[0].exercises')).toEqual({
      kind: 'workout',
      workoutIndex: 0,
      field: 'exercises',
    });
    expect(parseIssuePath('workouts[2].exercises[3].repMax')).toEqual({
      kind: 'exercise',
      workoutIndex: 2,
      exerciseIndex: 3,
      field: 'repMax',
    });
  });

  it('puts everything the editor cannot show next to a field under "other"', () => {
    expect(parseIssuePath('cycle.loadWeeks')).toEqual({ kind: 'other' });
    expect(parseIssuePath('workouts[0].id')).toEqual({ kind: 'other' });
    expect(parseIssuePath('workouts[0].exercises[1].id')).toEqual({ kind: 'other' });
  });
});

describe('issueMessage', () => {
  it('says plainly that a plan needs a workout and a workout needs an exercise', () => {
    expect(message('en', 'workouts', 'tooFew')).toBe('Add at least one workout');
    expect(message('en', 'workouts[0].exercises', 'tooFew')).toBe('Add at least one exercise to this workout');
    expect(message('pt-BR', 'workouts', 'tooFew')).toBe('Adicione pelo menos um treino');
    expect(message('pt-BR', 'workouts[0].exercises', 'tooFew')).toBe('Adicione pelo menos um exercício a este treino');
  });

  it('asks for names', () => {
    expect(message('en', 'name', 'required')).toBe('Enter a name');
    expect(message('en', 'workouts[0].name', 'required')).toBe('Enter a workout name');
    expect(message('pt-BR', 'name', 'required')).toBe('Informe um nome');
  });

  it('states the limits of a field', () => {
    expect(message('en', 'name', 'tooLong')).toBe('Use at most 60 characters');
    expect(message('en', 'workouts[0].name', 'tooLong')).toBe('Use at most 40 characters');
    expect(message('en', 'workouts[0].exercises[0].note', 'tooLong')).toBe('Use at most 200 characters');
    expect(message('en', 'workouts[0].exercises[0].sets', 'outOfRange')).toBe('Use a value from 1 to 20');
    expect(message('en', 'workouts[0].exercises[0].repMin', 'outOfRange')).toBe('Use a value from 1 to 100');
    expect(message('en', 'workouts[0].exercises[0].restSeconds', 'outOfRange')).toBe('Use a value from 0 to 900');
    expect(message('pt-BR', 'workouts[0].exercises[0].targetRir', 'outOfRange')).toBe('Use um valor de 0 a 5');
    expect(message('en', 'workouts', 'tooMany')).toBe('A plan has at most 14 workouts');
    expect(message('en', 'workouts[0].exercises', 'tooMany')).toBe('A workout has at most 30 exercises');
  });

  it('covers every other code', () => {
    const exercise = 'workouts[0].exercises[0]';
    expect(message('en', `${exercise}.sets`, 'notInteger')).toBe('Use a whole number');
    expect(message('en', `${exercise}.repMax`, 'invalidRepRange')).toBe(
      'The maximum reps cannot be below the minimum',
    );
    expect(message('en', 'cycle.deloadVolumeFactor', 'invalidStep')).toBe('Plan settings: Use steps of 0.05');
    expect(message('en', `${exercise}.startLoadKg`, 'tooManyDecimals')).toBe('Use at most 2 decimal places');
    expect(message('en', `${exercise}.exerciseId`, 'unknownExercise')).toBe('This exercise no longer exists');
    expect(message('en', `${exercise}.id`, 'duplicateId')).toBe('Plan settings: Duplicate identifier');
    expect(message('en', `${exercise}.startLoadKg`, 'zeroLoadNotAllowed')).toBe(
      'Only bodyweight and band exercises take 0 kg',
    );
    expect(message('en', 'sessionsPerWeek', 'required')).toBe('Required');
  });

  it('words the superset issues in both locales', () => {
    const path = 'workouts[0].exercises[1].supersetGroup';
    expect(message('en', path, 'supersetNotAdjacent')).toBe(
      'Exercises of the same superset must be next to each other.',
    );
    expect(message('en', path, 'supersetSize')).toBe('A superset needs 2 to 4 exercises.');
    expect(message('pt-BR', path, 'supersetNotAdjacent')).toBe(
      'Os exercícios do mesmo bi-set precisam estar em sequência.',
    );
    expect(message('pt-BR', path, 'supersetSize')).toBe('Um bi-set precisa de 2 a 4 exercícios.');
  });

  it('words the invalid RIR ramp issue in both locales', () => {
    expect(message('en', 'cycle.rirRamp', 'invalidRirRamp')).toBe(
      'Plan settings: The effort ramp needs RIR values from 0 to 5, starting at or above the final value.',
    );
    expect(message('pt-BR', 'cycle.rirRamp', 'invalidRirRamp')).toBe(
      'Ajustes da periodização: A rampa de esforço precisa de valores de RIR de 0 a 5, começando igual ou acima do valor final.',
    );
  });

  it('produces a non-empty message for every code in both locales', () => {
    const codes: PlanIssueCode[] = [
      'required',
      'tooLong',
      'tooFew',
      'tooMany',
      'outOfRange',
      'notInteger',
      'invalidRepRange',
      'invalidStep',
      'tooManyDecimals',
      'unknownExercise',
      'duplicateId',
      'zeroLoadNotAllowed',
      'supersetNotAdjacent',
      'supersetSize',
      'invalidRirRamp',
    ];
    const paths = ['name', 'description', 'sessionsPerWeek', 'workouts', 'workouts[0].name', 'workouts[0].exercises', 'workouts[0].exercises[0].sets', 'cycle.loadWeeks'];
    for (const locale of ['en', 'pt-BR'] as const) {
      for (const code of codes) {
        for (const path of paths) {
          const text = message(locale, path, code);
          expect({ locale, path, code, text: text.length > 0 && !/\{\{/.test(text) }).toEqual({
            locale,
            path,
            code,
            text: true,
          });
        }
      }
    }
  });
});
