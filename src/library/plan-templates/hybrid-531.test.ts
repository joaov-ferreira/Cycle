import { DEFAULT_CYCLE, type CycleConfig } from '../../domain/cycle';
import { validatePlanContent } from '../../domain/plan';
import { expandWorkout, prescribeExercise } from '../../domain/program-plan';
import { findExercise } from '../exercises';
import { findProgram } from '../programs';
import {
  ALL_PLAN_TEMPLATES,
  HYBRID_531,
  STRENGTH_PLAN_TEMPLATES,
  findPlanTemplate,
  instantiateTemplate,
  listAllPlanTemplates,
  listPlanTemplates,
} from './index';
import type { TemplateLocale } from './types';

const LOCALES: TemplateLocale[] = ['en', 'pt-BR'];
const MAIN_LIFTS = ['barbell-back-squat', 'barbell-bench-press', 'conventional-deadlift', 'overhead-press'];

describe('strength template registry', () => {
  it('keeps the six SPEC §3.3 templates unchanged and lists the hybrid on its own', () => {
    expect(listPlanTemplates()).toHaveLength(6);
    expect(STRENGTH_PLAN_TEMPLATES).toEqual([HYBRID_531]);
    expect(listAllPlanTemplates().map((t) => t.id)).toEqual([
      'full-body-3x',
      'upper-lower-4x',
      'push-pull-legs',
      'abc',
      'abcd',
      'abcde',
      'hybrid-531',
    ]);
    expect(ALL_PLAN_TEMPLATES).toBe(listAllPlanTemplates());
    expect(findPlanTemplate('hybrid-531')).toBe(HYBRID_531);
  });
});

describe('hybrid 5/3/1 template (SPEC-v4 §11.3)', () => {
  it('has four workouts, four sessions a week and a 3 + 1 cycle', () => {
    expect(HYBRID_531.workouts).toHaveLength(4);
    expect(HYBRID_531.sessionsPerWeek).toBe(4);
    expect(HYBRID_531.cycle).toEqual({ loadWeeks: 3, deloadWeeks: 1 });
  });

  it('has trimmed names and descriptions in both locales', () => {
    for (const locale of LOCALES) {
      for (const text of [
        HYBRID_531.name[locale],
        HYBRID_531.description[locale],
        ...HYBRID_531.workouts.map((w) => w.name[locale]),
      ]) {
        expect(text.length).toBeGreaterThan(0);
        expect(text).toBe(text.trim());
      }
    }
  });

  it('gives each workout one custom 5/3/1 block on one of the four main lifts, in order', () => {
    const lifts = HYBRID_531.workouts.map((workout) => {
      expect(workout.programs).toHaveLength(1);
      const [block] = workout.programs ?? [];
      expect(block).toMatchObject({ programId: 'cycle-531-custom', day: 1, accessories: false });
      return block.roles.lift;
    });
    expect(lifts).toEqual(MAIN_LIFTS);
  });

  it('follows each block with 3–4 accessories on rep ranges, none repeated, none of the main lifts', () => {
    for (const workout of HYBRID_531.workouts) {
      expect(workout.exercises.length).toBeGreaterThanOrEqual(3);
      expect(workout.exercises.length).toBeLessThanOrEqual(4);
      const ids = workout.exercises.map((e) => e.exerciseId);
      expect(new Set(ids).size).toBe(ids.length);
      for (const item of workout.exercises) {
        expect(MAIN_LIFTS).not.toContain(item.exerciseId);
        expect(item.repMin).toBeLessThan(item.repMax);
        expect(item.targetRir).toBeGreaterThanOrEqual(1);
        expect(item.targetRir).toBeLessThanOrEqual(3);
        expect(findExercise(item.exerciseId)).toBeDefined();
      }
    }
  });

  it.each(LOCALES)('instantiates to valid plan content in %s, validated with the program lookup', (locale) => {
    const content = instantiateTemplate(HYBRID_531, locale);
    expect(validatePlanContent(content, findExercise, { findProgram })).toEqual([]);
    expect(content.workouts.map((w) => w.id)).toEqual(['w1', 'w2', 'w3', 'w4']);
    expect(content.workouts[0].programs).toEqual([
      {
        id: 'w1p1',
        programId: 'cycle-531-custom',
        day: 1,
        startWeek: 1,
        roles: { lift: 'barbell-back-squat' },
        accessories: false,
      },
    ]);
    expect(content.workouts[0].exercises[0].id).toBe('w1e1');
    const ids = content.workouts.flatMap((w) => [
      ...(w.programs ?? []).map((p) => p.id),
      ...w.exercises.map((e) => e.id),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps its own cycle length but takes the factors of the cycle passed in', () => {
    const passed: CycleConfig = { loadWeeks: 8, deloadWeeks: 2, deloadVolumeFactor: 0.6, deloadLoadFactor: 0.8 };
    expect(instantiateTemplate(HYBRID_531, 'en', passed).cycle).toEqual({
      loadWeeks: 3,
      deloadWeeks: 1,
      deloadVolumeFactor: 0.6,
      deloadLoadFactor: 0.8,
    });
    expect(instantiateTemplate(HYBRID_531, 'en').cycle).toEqual({
      loadWeeks: 3,
      deloadWeeks: 1,
      deloadVolumeFactor: DEFAULT_CYCLE.deloadVolumeFactor,
      deloadLoadFactor: DEFAULT_CYCLE.deloadLoadFactor,
    });
  });

  it('prescribes 3×5 @ 105, 3×3 @ 120, 3×1 @ 132.5 on the squat day (1RM 140) and 2×5 @ 95 in the deload', () => {
    const content = instantiateTemplate(HYBRID_531, 'en');
    const [squatDay] = content.workouts;
    const env = (phase: 'load' | 'deload', cycleWeek: number) => ({
      phase,
      cycleWeek,
      cycle: content.cycle,
      maxKg: (id: string) => (id === 'barbell-back-squat' ? 140 : null),
      incrementKg: () => 2.5,
      roundingMode: 'nearest' as const,
    });
    const view = (phase: 'load' | 'deload', cycleWeek: number) => {
      const { exercises } = expandWorkout(squatDay, { phase, cycleWeek, findProgram });
      const main = prescribeExercise(exercises[0], env(phase, cycleWeek));
      return [exercises.length, main?.sets.map((s) => `${s.reps}@${s.kg}`)];
    };
    expect(view('load', 1)).toEqual([5, ['5@105', '5@105', '5@105']]);
    expect(view('load', 2)).toEqual([5, ['3@120', '3@120', '3@120']]);
    expect(view('load', 3)).toEqual([5, ['1@132.5', '1@132.5', '1@132.5']]);
    expect(view('deload', 1)).toEqual([5, ['5@95', '5@95']]);
    // the accessories stay on automatic progression
    const effective = expandWorkout(squatDay, { phase: 'load', cycleWeek: 1, findProgram });
    expect(effective.exercises.slice(1).every((e) => e.percent === undefined)).toBe(true);
  });
});
