import { parsePlanImport, unresolvedReferences } from '@/domain/plan-import';
import { catalogs } from '@/i18n';
import { listExercises } from '@/library';

describe('the plain-text example of the import screen', () => {
  it.each([
    ['en', 'Upper', 'Lower'],
    ['pt-BR', 'Superior', 'Inferior'],
  ] as const)('parses against the real library without unresolved exercises (%s)', (locale, upper, lower) => {
    const example = catalogs[locale].planImport.input.example;

    const result = parsePlanImport(example, listExercises());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(unresolvedReferences(result.draft)).toEqual([]);
    expect(result.draft.cycle).toMatchObject({ loadWeeks: 6, deloadWeeks: 1 });
    expect(result.draft.workouts.map((workout) => workout.name)).toEqual([upper, lower]);
    expect(result.draft.workouts.map((workout) => workout.exercises.length)).toEqual([2, 1]);
  });
});
