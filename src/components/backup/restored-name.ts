import { MAX_PROFILE_NAME_LENGTH } from '@/domain/validation';

/**
 * The name of the profile a backup is restored into: `build(profileName)` is the localized
 * "<name> (restored)"; the result is unique (case-insensitively) among `existing` names and at
 * most `MAX_PROFILE_NAME_LENGTH` characters, shortening the original name (not the suffix).
 */
export function restoredProfileName(
  original: string,
  build: (name: string) => string,
  existing: readonly string[],
): string {
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()));
  const fit = (n: number): string => {
    const counter = n > 1 ? ` ${n}` : '';
    let base = original.trim();
    for (;;) {
      const candidate = `${build(base)}${counter}`;
      if (candidate.length <= MAX_PROFILE_NAME_LENGTH || base.length === 0) return candidate;
      base = base.slice(0, Math.max(0, base.length - (candidate.length - MAX_PROFILE_NAME_LENGTH))).trimEnd();
    }
  };
  for (let n = 1; ; n++) {
    const candidate = fit(n);
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}
