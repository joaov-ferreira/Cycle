import { catalogs } from '@/i18n/catalogs';
import { translate } from '@/i18n/translate';
import { APP_LOCALES, type AppLocale } from '@/i18n/locale';
import { EQUIPMENT, MECHANICS, MUSCLE_GROUPS, type Exercise } from '@/domain/exercise';

import {
  equipmentLabelKey,
  exerciseName,
  muscleLabelKey,
  mechanicsLabelKey,
} from './labels';

const bench: Exercise = {
  id: 'barbell-bench-press',
  name: { en: 'Barbell Bench Press', 'pt-BR': 'Supino reto com barra' },
  aliases: [],
  primaryMuscle: 'chest',
  secondaryMuscles: ['triceps'],
  equipment: 'barbell',
  mechanics: 'compound',
  custom: false,
  archived: false,
};

describe('exerciseName', () => {
  it('returns the name in the requested locale', () => {
    expect(exerciseName(bench, 'en')).toBe('Barbell Bench Press');
    expect(exerciseName(bench, 'pt-BR')).toBe('Supino reto com barra');
  });

  it('returns the same text for custom exercises in both locales', () => {
    const custom: Exercise = {
      ...bench,
      id: 'custom-1',
      custom: true,
      name: { en: 'Zercher squat', 'pt-BR': 'Zercher squat' },
    };
    expect(exerciseName(custom, 'pt-BR')).toBe('Zercher squat');
  });
});

describe.each(APP_LOCALES)('label keys (%s)', (locale: AppLocale) => {
  it.each(MUSCLE_GROUPS)('has a translated muscle label for %s', (muscle) => {
    const key = muscleLabelKey(muscle);
    const text = translate(catalogs[locale], locale, key);
    expect(text.trim()).not.toBe('');
    expect(text).not.toBe(key);
  });

  it.each(EQUIPMENT)('has a translated equipment label for %s', (equipment) => {
    const key = equipmentLabelKey(equipment);
    const text = translate(catalogs[locale], locale, key);
    expect(text.trim()).not.toBe('');
    expect(text).not.toBe(key);
  });

  it.each(MECHANICS)('has a translated mechanics label for %s', (mechanics) => {
    const key = mechanicsLabelKey(mechanics);
    const text = translate(catalogs[locale], locale, key);
    expect(text.trim()).not.toBe('');
    expect(text).not.toBe(key);
  });
});

describe('pt-BR vocabulary (SPEC §12.1)', () => {
  const label = (key: ReturnType<typeof muscleLabelKey>) =>
    translate(catalogs['pt-BR'], 'pt-BR', key);

  it('translates muscle groups, equipment and mechanics as agreed', () => {
    expect(MUSCLE_GROUPS.map((m) => label(muscleLabelKey(m)))).toEqual([
      'Peito', 'Costas', 'Ombros', 'Trapézio', 'Bíceps', 'Tríceps', 'Antebraços',
      'Abdômen', 'Lombar', 'Glúteos', 'Quadríceps', 'Posteriores de coxa', 'Adutores',
      'Abdutores', 'Panturrilhas',
    ]);
    expect(EQUIPMENT.map((e) => label(equipmentLabelKey(e)))).toEqual([
      'Barra', 'Halteres', 'Máquina', 'Polia', 'Smith', 'Kettlebell', 'Peso corporal',
      'Elástico', 'Outro',
    ]);
    expect(MECHANICS.map((m) => label(mechanicsLabelKey(m)))).toEqual(['Multiarticular', 'Isolado']);
  });
});
