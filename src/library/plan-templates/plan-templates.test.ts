import { DEFAULT_CYCLE, type CycleConfig } from '../../domain/cycle';
import { validatePlanContent } from '../../domain/plan';
import type { MuscleGroup } from '../../domain/exercise';
import { findExercise } from '../exercises';
import { findPlanTemplate, instantiateTemplate, listPlanTemplates, PLAN_TEMPLATES } from './index';
import type { PlanTemplate, TemplateLocale } from './types';

const LOCALES: TemplateLocale[] = ['en', 'pt-BR'];
const TRAINED_MUSCLES: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings',
];

const EXPECTED: Record<string, { workouts: number; sessionsPerWeek: number }> = {
  'full-body-3x': { workouts: 2, sessionsPerWeek: 3 },
  'upper-lower-4x': { workouts: 4, sessionsPerWeek: 4 },
  'push-pull-legs': { workouts: 3, sessionsPerWeek: 6 },
  abc: { workouts: 3, sessionsPerWeek: 3 },
  abcd: { workouts: 4, sessionsPerWeek: 4 },
  abcde: { workouts: 5, sessionsPerWeek: 5 },
};

function exerciseOf(exerciseId: string) {
  const exercise = findExercise(exerciseId);
  if (!exercise) throw new Error(`unknown exercise ${exerciseId}`);
  return exercise;
}

describe('built-in plan template registry', () => {
  it('lists the six SPEC §3.3 templates in table order', () => {
    expect(PLAN_TEMPLATES.map((t) => t.id)).toEqual([
      'full-body-3x',
      'upper-lower-4x',
      'push-pull-legs',
      'abc',
      'abcd',
      'abcde',
    ]);
    expect(listPlanTemplates()).toEqual(PLAN_TEMPLATES);
  });

  it('finds a template by id and returns undefined for a miss', () => {
    expect(findPlanTemplate('push-pull-legs')?.id).toBe('push-pull-legs');
    expect(findPlanTemplate('nope')).toBeUndefined();
  });

  it.each(Object.keys(EXPECTED))('%s has the workouts and sessionsPerWeek of SPEC §3.3', (id) => {
    const template = findPlanTemplate(id) as PlanTemplate;
    expect(template.workouts).toHaveLength(EXPECTED[id].workouts);
    expect(template.sessionsPerWeek).toBe(EXPECTED[id].sessionsPerWeek);
  });
});

describe.each(Object.keys(EXPECTED))('template %s', (id) => {
  const template = findPlanTemplate(id) as PlanTemplate;

  it('has non-empty, trimmed names and descriptions in both locales', () => {
    for (const locale of LOCALES) {
      for (const text of [template.name[locale], template.description[locale]]) {
        expect(text.length).toBeGreaterThan(0);
        expect(text).toBe(text.trim());
      }
      for (const workout of template.workouts) {
        expect(workout.name[locale].length).toBeGreaterThan(0);
        expect(workout.name[locale]).toBe(workout.name[locale].trim());
      }
    }
  });

  it.each(LOCALES)('instantiates to valid plan content in %s', (locale) => {
    const content = instantiateTemplate(template, locale);
    expect(validatePlanContent(content, findExercise)).toEqual([]);
  });

  it('gives every workout 4–8 exercises with no repeated exercise', () => {
    for (const workout of template.workouts) {
      expect(workout.exercises.length).toBeGreaterThanOrEqual(4);
      expect(workout.exercises.length).toBeLessThanOrEqual(8);
      const ids = workout.exercises.map((e) => e.exerciseId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('keeps sets, reps, RIR and rest inside the typical ranges', () => {
    for (const workout of template.workouts) {
      for (const item of workout.exercises) {
        expect(item.sets).toBeGreaterThanOrEqual(2);
        expect(item.sets).toBeLessThanOrEqual(5);
        expect(item.repMin).toBeGreaterThanOrEqual(5);
        expect(item.repMax).toBeLessThanOrEqual(20);
        expect(item.repMin).toBeLessThan(item.repMax);
        if (item.targetRir !== undefined) {
          expect(item.targetRir).toBeGreaterThanOrEqual(1);
          expect(item.targetRir).toBeLessThanOrEqual(3);
        }
        if (item.restSeconds !== undefined) {
          expect(item.restSeconds).toBeGreaterThanOrEqual(60);
          expect(item.restSeconds).toBeLessThanOrEqual(180);
        }
      }
    }
  });

  it('puts compound movements first, with RIR 2 and rest 120–180 s, then isolation with RIR 1 and rest 60–90 s', () => {
    for (const workout of template.workouts) {
      let seenIsolation = false;
      for (const item of workout.exercises) {
        const { mechanics } = exerciseOf(item.exerciseId);
        if (mechanics === 'isolation') {
          seenIsolation = true;
          expect(item.targetRir).toBe(1);
          expect(item.restSeconds).toBeGreaterThanOrEqual(60);
          expect(item.restSeconds).toBeLessThanOrEqual(90);
        } else {
          expect(seenIsolation).toBe(false);
          expect(item.targetRir).toBe(2);
          expect(item.restSeconds).toBeGreaterThanOrEqual(120);
          expect(item.restSeconds).toBeLessThanOrEqual(180);
        }
      }
    }
  });

  it('trains every core muscle as the primary muscle of some exercise', () => {
    const primaries = new Set<MuscleGroup>();
    for (const workout of template.workouts) {
      for (const item of workout.exercises) {
        primaries.add(exerciseOf(item.exerciseId).primaryMuscle);
      }
    }
    for (const muscle of TRAINED_MUSCLES) {
      expect(primaries.has(muscle)).toBe(true);
    }
  });
});

describe('instantiateTemplate', () => {
  const pushPullLegs = findPlanTemplate('push-pull-legs') as PlanTemplate;

  it('uses the locale for name, description and workout names', () => {
    const en = instantiateTemplate(pushPullLegs, 'en');
    const ptBR = instantiateTemplate(pushPullLegs, 'pt-BR');
    expect(en.name).toBe(pushPullLegs.name.en);
    expect(en.description).toBe(pushPullLegs.description.en);
    expect(en.workouts.map((w) => w.name)).toEqual(pushPullLegs.workouts.map((w) => w.name.en));
    expect(ptBR.name).toBe(pushPullLegs.name['pt-BR']);
    expect(ptBR.workouts.map((w) => w.name)).toEqual(
      pushPullLegs.workouts.map((w) => w.name['pt-BR']),
    );
    expect(ptBR.name).not.toBe(en.name);
  });

  it('copies sessionsPerWeek from the template', () => {
    expect(instantiateTemplate(pushPullLegs, 'en').sessionsPerWeek).toBe(6);
  });

  it('uses DEFAULT_CYCLE when no cycle is given', () => {
    expect(instantiateTemplate(pushPullLegs, 'en').cycle).toEqual(DEFAULT_CYCLE);
  });

  it('uses the given cycle otherwise', () => {
    const cycle: CycleConfig = {
      loadWeeks: 4,
      deloadWeeks: 0,
      deloadVolumeFactor: 0.5,
      deloadLoadFactor: 0.9,
    };
    expect(instantiateTemplate(pushPullLegs, 'pt-BR', cycle).cycle).toEqual(cycle);
  });

  it('generates workout ids w1, w2, … and plan-exercise ids w1e1, w1e2, … unique per plan', () => {
    const content = instantiateTemplate(pushPullLegs, 'en');
    expect(content.workouts.map((w) => w.id)).toEqual(['w1', 'w2', 'w3']);
    expect(content.workouts[1].exercises.map((e) => e.id)).toEqual(
      content.workouts[1].exercises.map((_, i) => `w2e${i + 1}`),
    );
    expect(content.workouts[0].exercises[0].id).toBe('w1e1');
    const exerciseIds = content.workouts.flatMap((w) => w.exercises.map((e) => e.id));
    expect(new Set(exerciseIds).size).toBe(exerciseIds.length);
  });

  it('carries exercise targets over from the template without adding fields', () => {
    const content = instantiateTemplate(pushPullLegs, 'en');
    const source = pushPullLegs.workouts[0].exercises[0];
    expect(content.workouts[0].exercises[0]).toEqual({
      id: 'w1e1',
      exerciseId: source.exerciseId,
      sets: source.sets,
      repMin: source.repMin,
      repMax: source.repMax,
      targetRir: source.targetRir,
      restSeconds: source.restSeconds,
    });
  });
});
