/**
 * Memoized periodization selectors (SPEC §12.5). The periodization is derived from the slots,
 * the reference 1RMs, the rounding settings and the program parameters; it is recomputed only
 * when one of those state references changes, so every screen reading it stays in sync.
 */
import { generatePeriodization, type OneRmMap, type Periodization } from '@/domain/periodization';
import { listTemplates } from '@/programs/registry';

import { currentOneRms, roundingConfig, type AppState } from './app-store';

/** Caches the last result of `compute` for the same input references. */
export function memoizeLast<A extends readonly unknown[], R>(compute: (...args: A) => R): (...args: A) => R {
  let last: { args: A; result: R } | null = null;
  return (...args: A) => {
    if (last && last.args.length === args.length && last.args.every((arg, i) => Object.is(arg, args[i]))) {
      return last.result;
    }
    const result = compute(...args);
    last = { args, result };
    return result;
  };
}

const oneRmsOf = memoizeLast((history: AppState['oneRmHistory']) => currentOneRms({ oneRmHistory: history }));

/** Current reference 1RM per lift; the reference is stable until the history changes. */
export const selectCurrentOneRms = (state: AppState): OneRmMap => oneRmsOf(state.oneRmHistory);

const periodizationOf = memoizeLast(
  (
    slots: AppState['sessionSlots'],
    oneRms: OneRmMap,
    rounding: AppState['rounding'],
    params: AppState['programParams'],
  ): Periodization => generatePeriodization(slots, listTemplates(), oneRms, roundingConfig({ rounding }), params),
);

/** The live three-week periodization of the active profile (not the activated snapshot). */
export const selectPeriodization = (state: AppState): Periodization =>
  periodizationOf(state.sessionSlots, selectCurrentOneRms(state), state.rounding, state.programParams);
