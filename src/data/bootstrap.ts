import type { Profile, Repositories } from './repositories';

/**
 * First-boot setup: returns the oldest profile, creating one named `defaultName` when the
 * device has none yet. (Choosing among several profiles arrives with the profile selector.)
 */
export async function ensureDefaultProfile(
  repos: Repositories,
  defaultName: string,
): Promise<Profile> {
  const [existing] = await repos.profiles.list();
  return existing ?? repos.profiles.create({ name: defaultName });
}
