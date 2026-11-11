import type { Suggestion, SuggestionReason } from '@/domain/progression';
import { catalogs, type AppLocale } from '@/i18n';
import { formatKg, formatNumber, formatPercent } from '@/i18n/format';
import { translate } from '@/i18n/translate';

import { suggestionText, type SuggestionTarget, type SuggestionTextDeps } from './suggestion-text';

function deps(locale: AppLocale): SuggestionTextDeps {
  return {
    t: (key, params) => translate(catalogs[locale], locale, key, params),
    formatKg: (value, options) => formatKg(value, locale, options),
    formatNumber: (value, options) => formatNumber(value, locale, options),
    formatPercent: (fraction) => formatPercent(fraction, locale),
  };
}

/** Non-breaking spaces (between a value and `kg`) compared as plain spaces. */
const plain = (text: string) => text.replace(/ /g, ' ');

const TARGET: SuggestionTarget = { sets: 3, repMin: 8, repMax: 12 };

function suggestion(overrides: Partial<Suggestion> & Pick<Suggestion, 'reason'>): Suggestion {
  return {
    action: 'hold',
    loadKg: 40,
    sets: 3,
    targetReps: [8, 8, 8],
    lastLoadKg: 40,
    lastReps: [],
    stalled: false,
    ...overrides,
  };
}

type Case = [reason: SuggestionReason, s: Suggestion, en: string, ptBR: string, target?: SuggestionTarget];

const CASES: Case[] = [
  [
    'noHistory',
    suggestion({ reason: 'noHistory', action: 'start', loadKg: null, lastLoadKg: null }),
    'No history yet — choose a load for 8–12 reps',
    'Sem histórico ainda — escolha uma carga para 8–12 repetições',
  ],
  [
    'noHistory',
    suggestion({ reason: 'noHistory', action: 'start', loadKg: null, lastLoadKg: null }),
    'No history yet — choose a load for 5 reps',
    'Sem histórico ainda — escolha uma carga para 5 repetições',
    { sets: 5, repMin: 5, repMax: 5 },
  ],
  [
    'planStartLoad',
    suggestion({ reason: 'planStartLoad', action: 'start', loadKg: 60, lastLoadKg: null }),
    'Starting load from the plan: 60 kg',
    'Carga inicial da periodização: 60 kg',
  ],
  [
    'planStartLoad',
    suggestion({ reason: 'planStartLoad', action: 'start', loadKg: 42.5, lastLoadKg: null }),
    'Starting load from the plan: 42.5 kg',
    'Carga inicial da periodização: 42,5 kg',
  ],
  [
    'hitTopOfRange',
    suggestion({ reason: 'hitTopOfRange', action: 'increase', loadKg: 42.5, lastLoadKg: 40, lastReps: [12, 12, 12] }),
    'All 3 sets reached 12 reps at 40 kg → +2.5 kg',
    'As 3 séries chegaram a 12 repetições com 40 kg → +2,5 kg',
  ],
  [
    'hitTopOfRange',
    suggestion({ reason: 'hitTopOfRange', action: 'increase', loadKg: 25, lastLoadKg: 20, lastReps: [10] }),
    'The set reached 10 reps at 20 kg → +5 kg',
    'A série chegou a 10 repetições com 20 kg → +5 kg',
    { sets: 1, repMin: 6, repMax: 10 },
  ],
  [
    'hitTopOfRangeEasy',
    suggestion({ reason: 'hitTopOfRangeEasy', action: 'increase', loadKg: 45, lastLoadKg: 40, lastReps: [12, 12, 12] }),
    'All 3 sets reached 12 reps at 40 kg and felt easy → +5 kg',
    'As 3 séries chegaram a 12 repetições com 40 kg e foram fáceis → +5 kg',
  ],
  [
    'progressReps',
    suggestion({ reason: 'progressReps', targetReps: [12, 11, 10], lastReps: [12, 10, 9] }),
    'Same load (40 kg) — aim for 12, 11, 10 reps',
    'Mesma carga (40 kg) — busque 12, 11, 10 repetições',
  ],
  [
    'belowRange',
    suggestion({ reason: 'belowRange', targetReps: [8, 8, 8], lastReps: [8, 7, 6] }),
    'Below the rep range last time — repeat 40 kg and reach 8 reps',
    'Abaixo da faixa de repetições na última vez — repita 40 kg e chegue a 8 repetições',
  ],
  [
    'belowRangeTwice',
    suggestion({ reason: 'belowRangeTwice', action: 'decrease', loadKg: 35, lastLoadKg: 40 }),
    'Below the rep range twice — load reduced to 35 kg',
    'Abaixo da faixa de repetições duas vezes — carga reduzida para 35 kg',
  ],
  [
    'stalled',
    suggestion({ reason: 'stalled', stalled: true }),
    'No progress in the last 3 sessions — keep 40 kg; consider a deload',
    'Sem progresso nas últimas 3 sessões — mantenha 40 kg; considere um deload',
  ],
  [
    'deloadWeek',
    suggestion({ reason: 'deloadWeek', action: 'deload', loadKg: 37.5, sets: 2, lastLoadKg: 42.5, targetReps: [8, 8] }),
    'Deload: 2 sets at 37.5 kg (88% of 42.5 kg)',
    'Deload: 2 séries com 37,5 kg (88% de 42,5 kg)',
  ],
  [
    'deloadWeek',
    suggestion({ reason: 'deloadWeek', action: 'deload', loadKg: null, sets: 2, lastLoadKg: null, targetReps: [8, 8] }),
    'Deload: 2 easy sets',
    'Deload: 2 séries leves',
  ],
];

describe('suggestionText', () => {
  it.each(CASES)('%s in English: %s', (_reason, s, en, _pt, target = TARGET) => {
    expect(plain(suggestionText(s, target, deps('en')))).toBe(en);
  });

  it.each(CASES)('%s in Portuguese: %s', (_reason, s, _en, ptBR, target = TARGET) => {
    expect(plain(suggestionText(s, target, deps('pt-BR')))).toBe(ptBR);
  });

  it('shows the plan deload factor instead of the rounded ratio when it is given', () => {
    const s = suggestion({ reason: 'deloadWeek', action: 'deload', loadKg: 37.5, sets: 2, lastLoadKg: 42.5 });
    expect(plain(suggestionText(s, TARGET, deps('en'), { deloadLoadFactor: 0.9 }))).toBe(
      'Deload: 2 sets at 37.5 kg (90% of 42.5 kg)',
    );
  });

  it('falls back to the no-history text when the numbers of a reason are missing', () => {
    const s = suggestion({ reason: 'hitTopOfRange', loadKg: null, lastLoadKg: null });
    expect(plain(suggestionText(s, TARGET, deps('en')))).toBe('No history yet — choose a load for 8–12 reps');
  });
});
