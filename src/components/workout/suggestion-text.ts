/**
 * One-line localized explanation of a load suggestion (SPEC §6.4), built from the reason and the
 * numbers of the `Suggestion`. Pure: takes the translation and formatting functions.
 */
import type { Suggestion } from '@/domain/progression';
import type { I18nValue } from '@/i18n';

/** The plan target the suggestion was made for. */
export type SuggestionTarget = { sets: number; repMin: number; repMax: number };

export type SuggestionTextDeps = Pick<I18nValue, 't' | 'formatKg' | 'formatNumber' | 'formatPercent'>;

/** `8–12`, or `8` when the range is a single value. */
export function repsRange(repMin: number, repMax: number): string {
  return repMin === repMax ? String(repMin) : `${repMin}–${repMax}`;
}

/** Rounds away floating-point noise (`42.5 − 40`, `0.9 × 100`). */
const round3 = (value: number): number => Math.round(value * 1000) / 1000;

export function suggestionText(
  suggestion: Suggestion,
  target: SuggestionTarget,
  { t, formatKg, formatNumber, formatPercent }: SuggestionTextDeps,
  options: { deloadLoadFactor?: number } = {},
): string {
  const kg = (value: number) => formatKg(value, { minimumFractionDigits: 0 });
  const { loadKg, lastLoadKg } = suggestion;

  const noHistory = () => t('workout.suggestion.noHistory', { range: repsRange(target.repMin, target.repMax) });

  switch (suggestion.reason) {
    case 'noHistory':
      return noHistory();

    case 'planStartLoad':
      return loadKg === null ? noHistory() : t('workout.suggestion.planStartLoad', { load: kg(loadKg) });

    case 'hitTopOfRange':
    case 'hitTopOfRangeEasy': {
      if (loadKg === null || lastLoadKg === null) return noHistory();
      const key =
        suggestion.reason === 'hitTopOfRange'
          ? 'workout.suggestion.hitTopOfRange'
          : 'workout.suggestion.hitTopOfRangeEasy';
      return t(key, {
        count: target.sets,
        reps: formatNumber(target.repMax),
        last: kg(lastLoadKg),
        delta: kg(round3(loadKg - lastLoadKg)),
      });
    }

    case 'progressReps':
      if (loadKg === null) return noHistory();
      return t('workout.suggestion.progressReps', {
        load: kg(loadKg),
        reps: suggestion.targetReps.map((reps) => formatNumber(reps)).join(', '),
      });

    case 'belowRange':
      if (loadKg === null) return noHistory();
      return t('workout.suggestion.belowRange', { load: kg(loadKg), reps: formatNumber(target.repMin) });

    case 'belowRangeTwice':
      if (loadKg === null) return noHistory();
      return t('workout.suggestion.belowRangeTwice', { load: kg(loadKg) });

    case 'stalled':
      if (loadKg === null) return noHistory();
      return t('workout.suggestion.stalled', { load: kg(loadKg) });

    case 'deloadWeek': {
      if (loadKg === null || lastLoadKg === null || lastLoadKg === 0) {
        return t('workout.suggestion.deloadNoHistory', { count: suggestion.sets });
      }
      const ratio = options.deloadLoadFactor ?? Math.round((loadKg / lastLoadKg) * 100) / 100;
      return t('workout.suggestion.deloadWeek', {
        count: suggestion.sets,
        load: kg(loadKg),
        percent: formatPercent(ratio),
        last: kg(lastLoadKg),
      });
    }
  }
}
