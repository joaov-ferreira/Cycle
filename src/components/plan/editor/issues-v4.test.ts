import { catalogs, translate, type AppLocale, type MessageKey, type TranslationParams } from '@/i18n';
import type { PlanIssueCode } from '@/domain/plan';

import { issueMessage, parseIssuePath } from './issues';

const tFor =
  (locale: AppLocale) =>
  (key: MessageKey, params?: TranslationParams) =>
    translate(catalogs[locale], locale, key, params);

const message = (locale: AppLocale, path: string, code: PlanIssueCode) =>
  issueMessage(tFor(locale), (n) => String(n), { path, code });

describe('v4 paths (percent schemes and program blocks)', () => {
  const exercise = 'workouts[1].exercises[2]';
  const block = 'workouts[0].programs[1]';

  it('maps percent scheme paths to the exercise, week and group', () => {
    expect(parseIssuePath(`${exercise}.percent.weeks`)).toEqual({
      kind: 'percent',
      workoutIndex: 1,
      exerciseIndex: 2,
      field: 'weeks',
    });
    expect(parseIssuePath(`${exercise}.percent.startWeek`)).toMatchObject({ kind: 'percent', field: 'startWeek' });
    expect(parseIssuePath(`${exercise}.percent.basisExerciseId`)).toMatchObject({
      kind: 'percent',
      field: 'basisExerciseId',
    });
    expect(parseIssuePath(`${exercise}.percent.weeks[3].sets`)).toEqual({
      kind: 'percent',
      workoutIndex: 1,
      exerciseIndex: 2,
      field: 'sets',
      weekIndex: 3,
    });
    expect(parseIssuePath(`${exercise}.percent.weeks[3].sets[4].percent`)).toEqual({
      kind: 'percent',
      workoutIndex: 1,
      exerciseIndex: 2,
      field: 'percent',
      weekIndex: 3,
      groupIndex: 4,
    });
  });

  it('maps block paths to the block and its field', () => {
    expect(parseIssuePath(`${block}.programId`)).toEqual({
      kind: 'block',
      workoutIndex: 0,
      blockIndex: 1,
      field: 'programId',
    });
    expect(parseIssuePath(`${block}.day`)).toMatchObject({ kind: 'block', field: 'day' });
    expect(parseIssuePath(`${block}.roles`)).toMatchObject({ kind: 'block', field: 'roles' });
    expect(parseIssuePath(`${block}.roles.lift`)).toEqual({
      kind: 'block',
      workoutIndex: 0,
      blockIndex: 1,
      field: 'roles',
      key: 'lift',
    });
    expect(parseIssuePath(`${block}.params.weeklyIncrementKg`)).toMatchObject({
      kind: 'block',
      field: 'params',
      key: 'weeklyIncrementKg',
    });
    expect(parseIssuePath('workouts[0].programs')).toEqual({ kind: 'workout', workoutIndex: 0, field: 'programs' });
    expect(parseIssuePath(`${block}.id`)).toEqual({ kind: 'other' });
  });

  it('words the scheme issues with their limits in both locales', () => {
    const set = `${exercise}.percent.weeks[0].sets[0]`;
    expect(message('en', `${set}.percent`, 'outOfRange')).toBe('Use a value from 1 to 120');
    expect(message('en', `${set}.percent`, 'invalidStep')).toBe('Use steps of 0.5');
    expect(message('en', `${set}.reps`, 'outOfRange')).toBe('Use a value from 1 to 100');
    expect(message('en', `${set}.repeat`, 'outOfRange')).toBe('Use a value from 1 to 20');
    expect(message('en', `${set}.addKg`, 'outOfRange')).toBe('Use a value from -100 to 100');
    expect(message('en', `${set}.addKg`, 'tooManyDecimals')).toBe('Use at most 2 decimal places');
    expect(message('pt-BR', `${set}.percent`, 'outOfRange')).toBe('Use um valor de 1 a 120');
    expect(message('en', `${exercise}.percent.weeks`, 'emptyScheme')).toBe(
      'The scheme needs at least one week with sets',
    );
    expect(message('en', `${exercise}.percent.weeks`, 'tooMany')).toBe('A scheme has at most 16 weeks');
    expect(message('en', `${exercise}.percent.weeks[1].sets`, 'tooMany')).toBe(
      'A week has at most 20 groups and 40 sets',
    );
    expect(message('en', `${exercise}.percent.startWeek`, 'outOfRange')).toBe(
      'Choose a week of the scheme as the starting week',
    );
    expect(message('en', `${exercise}.percent.basisExerciseId`, 'unknownExercise')).toBe(
      'This exercise no longer exists',
    );
    expect(message('en', `${exercise}.targetRir`, 'notAllowedWithPercent')).toBe(
      'RIR and starting load are not used with percent of 1RM',
    );
  });

  it('words the block issues in both locales', () => {
    expect(message('en', `${block}.programId`, 'unknownProgram')).toBe('This program does not exist');
    expect(message('en', `${block}.day`, 'outOfRange')).toBe('Choose a day of the program');
    expect(message('pt-BR', `${block}.day`, 'outOfRange')).toBe('Escolha um dia do programa');
    expect(message('en', `${block}.startWeek`, 'outOfRange')).toBe('Choose a week of the program');
    expect(message('en', `${block}.roles`, 'noRoleMapped')).toBe(
      'Choose an exercise for at least one role of the program',
    );
    expect(message('en', `${block}.roles.lift`, 'unknownExercise')).toBe('This exercise no longer exists');
    expect(message('en', `${block}.params.weeklyIncrementKg`, 'paramOutOfRange')).toBe(
      'Program parameter out of range',
    );
    expect(message('en', 'workouts[0].programs', 'tooMany')).toBe('A workout has at most 4 program blocks');
    expect(message('pt-BR', 'workouts[0].programs', 'tooMany')).toBe('Um treino tem no máximo 4 blocos de programa');
    expect(message('en', `${block}.id`, 'duplicateId')).toBe('Plan settings: Duplicate identifier');
  });
});
