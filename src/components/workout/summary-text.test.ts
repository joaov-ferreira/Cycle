import type { NewRecord } from '@/domain/stats';
import type { LoggedSet, Workout } from '@/domain/workout';
import { workoutSummary } from '@/domain/workout';
import { catalogs, type AppLocale } from '@/i18n';
import { formatDate, formatKg, formatNumber } from '@/i18n/format';
import { translate } from '@/i18n/translate';

import { signedChange, summaryText } from './summary-text';

const set = (
  kind: LoggedSet['kind'],
  weightKg: number | null,
  reps: number | null,
  done = true,
): LoggedSet => ({
  kind,
  weightKg,
  reps,
  rir: null,
  done,
});

const workout: Workout = {
  id: 1,
  profileId: 1,
  planId: null,
  planWorkoutId: null,
  name: 'Push A',
  status: 'completed',
  phase: 'load',
  cycleNumber: null,
  cycleWeek: null,
  startedAt: '2026-03-02T14:00:00.000Z',
  completedAt: '2026-03-02T15:00:00.000Z',
  notes: '',
  exercises: [
    {
      exerciseId: 'bench',
      planExerciseId: null,
      target: null,
      note: '',
      sets: [
        set('warmup', 20, 8),
        set('working', 40, 12),
        set('working', 40, 12),
        set('working', 42.5, 8),
        set('drop', 32.5, 8),
        set('working', 42.5, 5, false),
      ],
    },
    {
      exerciseId: 'row',
      planExerciseId: null,
      target: null,
      note: '',
      sets: [set('working', 50, 10, false)],
    },
    {
      exerciseId: 'curl',
      planExerciseId: null,
      target: null,
      note: '',
      sets: [set('working', 15.5, 10)],
    },
  ],
};
const records: NewRecord[] = [{ exerciseId: 'bench', kind: 'weight', valueKg: 42.5, previousKg: 40 }];
const names: Record<string, Record<AppLocale, string>> = {
  bench: { en: 'Bench Press', 'pt-BR': 'Supino reto' },
  row: { en: 'Row', 'pt-BR': 'Remada' },
  curl: { en: 'Curl', 'pt-BR': 'Rosca' },
};

function build(locale: AppLocale, recs: NewRecord[] = records) {
  const i18n = {
    t: (key: never, params?: Record<string, string | number>) =>
      translate(catalogs[locale], locale, key, params),
    formatKg: (value: number, options?: object) => formatKg(value, locale, options),
    formatNumber: (value: number, options?: object) => formatNumber(value, locale, options),
    formatDate: (date: Date) => formatDate(date, locale),
  };
  return summaryText(i18n as never, {
    workout,
    summary: workoutSummary(workout),
    records: recs,
    nameOf: (id) => names[id][locale],
  }).replace(/ /g, ' ');
}

describe('summaryText', () => {
  it('builds the English text', () => {
    expect(build('en')).toBe(
      [
        'Push A',
        'Mar 2, 2026',
        'Bench Press: 40 kg × 12, 12 · 42.5 kg × 8 · drop 32.5 kg × 8',
        'Curl: 15.5 kg × 10',
        'Total volume: 1,715 kg',
        'Personal records:',
        'Bench Press: Weight record 42.5 kg (previous 40 kg)',
      ].join('\n'),
    );
  });

  it('builds the Portuguese text', () => {
    expect(build('pt-BR')).toBe(
      [
        'Push A',
        '2 de mar. de 2026',
        'Supino reto: 40 kg × 12, 12 · 42,5 kg × 8 · drop 32,5 kg × 8',
        'Rosca: 15,5 kg × 10',
        'Volume total: 1.715 kg',
        'Recordes pessoais:',
        'Supino reto: Recorde de carga 42,5 kg (anterior 40 kg)',
      ].join('\n'),
    );
  });

  it('omits the records block without records', () => {
    expect(build('en', []).split('\n').at(-1)).toBe('Total volume: 1,715 kg');
  });
});

describe('signedChange', () => {
  const t = ((key: Parameters<typeof translate<typeof catalogs.en>>[2], params?: Record<string, string | number>) =>
    translate(catalogs.en, 'en', key, params)) as Parameters<typeof signedChange>[0];

  it('signs a positive, zero and negative change', () => {
    expect(signedChange(t, 2.5, '2.5 kg')).toBe('+2.5 kg');
    expect(signedChange(t, 0, '0 kg')).toBe('+0 kg');
    expect(signedChange(t, -105, '105 kg')).toBe('−105 kg');
  });
});
