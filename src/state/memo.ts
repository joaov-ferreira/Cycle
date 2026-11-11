/**
 * Tiny memoization for selectors: results are cached per argument key and dropped as soon as
 * any of the state slices the selector depends on changes identity. This keeps selectors that
 * derive collections referentially stable between renders (needed by `useStore`).
 */
export function memoSelector<S, A extends unknown[], R>(
  deps: (state: S) => readonly unknown[],
  compute: (state: S, ...args: A) => R,
  keyOf: (...args: A) => string = (...args) => JSON.stringify(args),
): (state: S, ...args: A) => R {
  let lastDeps: readonly unknown[] | null = null;
  let cache = new Map<string, R>();
  return (state, ...args) => {
    const current = deps(state);
    const previous = lastDeps;
    if (previous === null || current.length !== previous.length || current.some((v, i) => v !== previous[i])) {
      lastDeps = current;
      cache = new Map();
    }
    const key = keyOf(...args);
    if (cache.has(key)) return cache.get(key) as R;
    const value = compute(state, ...args);
    cache.set(key, value);
    return value;
  };
}
