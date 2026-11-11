import type { Exercise } from '../domain/exercise';
import { AI_PLAN_PROMPT_TEMPLATE, buildAiPlanPrompt, exercisePromptLine } from './ai-prompt';

function exercise(overrides: Partial<Exercise> & Pick<Exercise, 'id'>): Exercise {
  return {
    name: { en: 'Name', 'pt-BR': 'Nome' },
    aliases: [],
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    mechanics: 'compound',
    custom: false,
    archived: false,
    ...overrides,
  };
}

const BENCH = exercise({
  id: 'barbell-bench-press',
  name: { en: 'Barbell Bench Press', 'pt-BR': 'Supino reto com barra' },
  primaryMuscle: 'chest',
  equipment: 'barbell',
});

const HAMMER_ROW = exercise({
  id: 'custom-7',
  name: { en: 'Hammer row', 'pt-BR': 'Remada Hammer' },
  primaryMuscle: 'back',
  equipment: 'machine',
  custom: true,
});

describe('exercisePromptLine', () => {
  it('formats a built-in exercise in English', () => {
    expect(exercisePromptLine(BENCH, 'en')).toBe('barbell-bench-press — Barbell Bench Press — chest — barbell');
  });

  it('formats a built-in exercise in Brazilian Portuguese', () => {
    expect(exercisePromptLine(BENCH, 'pt-BR')).toBe('barbell-bench-press — Supino reto com barra — chest — barbell');
  });

  it('uses the raw muscle and equipment enum values', () => {
    expect(exercisePromptLine(HAMMER_ROW, 'pt-BR')).toBe('custom-7 — Remada Hammer — back — machine');
  });
});

describe('AI_PLAN_PROMPT_TEMPLATE', () => {
  it('has one {{EXERCISES}} placeholder in each locale', () => {
    for (const locale of ['en', 'pt-BR'] as const) {
      expect(AI_PLAN_PROMPT_TEMPLATE[locale].split('{{EXERCISES}}')).toHaveLength(2);
    }
  });

  it('starts with the coach introduction of each locale', () => {
    expect(AI_PLAN_PROMPT_TEMPLATE.en.startsWith('You are an experienced strength and hypertrophy coach.')).toBe(true);
    expect(AI_PLAN_PROMPT_TEMPLATE['pt-BR'].startsWith('Você é um treinador experiente de força e hipertrofia.')).toBe(true);
  });
});

describe('buildAiPlanPrompt', () => {
  it('replaces the placeholder with one line per exercise, in the given order', () => {
    const prompt = buildAiPlanPrompt([BENCH, HAMMER_ROW], 'en');
    const expectedList = [
      'barbell-bench-press — Barbell Bench Press — chest — barbell',
      'custom-7 — Hammer row — back — machine',
    ].join('\n');
    expect(prompt).toBe(AI_PLAN_PROMPT_TEMPLATE.en.replace('{{EXERCISES}}', expectedList));
  });

  it('uses the pt-BR template and names for the pt-BR locale', () => {
    const prompt = buildAiPlanPrompt([BENCH], 'pt-BR');
    expect(prompt.startsWith('Você é um treinador')).toBe(true);
    expect(prompt).toContain('barbell-bench-press — Supino reto com barra — chest — barbell');
    expect(prompt).not.toContain('{{EXERCISES}}');
  });

  it('skips archived exercises', () => {
    const archived = exercise({ id: 'custom-9', custom: true, archived: true, name: { en: 'Old', 'pt-BR': 'Antigo' } });
    const prompt = buildAiPlanPrompt([BENCH, archived], 'en');
    expect(prompt).not.toContain('custom-9');
    expect(prompt).not.toContain('Old');
    expect(prompt.endsWith('barbell-bench-press — Barbell Bench Press — chest — barbell')).toBe(true);
  });

  it('lists a custom exercise after the built-in ones, with its name', () => {
    const prompt = buildAiPlanPrompt([BENCH, HAMMER_ROW], 'pt-BR');
    expect(prompt.indexOf('barbell-bench-press —')).toBeLessThan(prompt.indexOf('custom-7 —'));
    expect(prompt).toContain('custom-7 — Remada Hammer — back — machine');
    expect(prompt.endsWith('custom-7 — Remada Hammer — back — machine')).toBe(true);
  });

  it('keeps the list unchanged when a name contains replacement patterns', () => {
    const tricky = exercise({ id: 'custom-3', custom: true, name: { en: 'Cost $& {{EXERCISES}}', 'pt-BR': 'x' } });
    const prompt = buildAiPlanPrompt([tricky], 'en');
    expect(prompt.endsWith('custom-3 — Cost $& {{EXERCISES}} — chest — barbell')).toBe(true);
  });

  it('with no exercises leaves an empty list after the placeholder line', () => {
    expect(buildAiPlanPrompt([], 'en')).toBe(AI_PLAN_PROMPT_TEMPLATE.en.replace('{{EXERCISES}}', ''));
  });
});
