import type { Profile, Repositories } from './repositories';

/**
 * First-boot setup: returns the remembered active profile, else the oldest one, creating a
 * profile named `defaultName` when the device has none yet. The chosen profile is
 * remembered as active.
 */
export async function ensureDefaultProfile(
  repos: Repositories,
  defaultName: string,
): Promise<Profile> {
  const activeId = await repos.profiles.getActiveId();
  const active = activeId === null ? null : await repos.profiles.getById(activeId);
  if (active) return active;

  const [oldest] = await repos.profiles.list();
  const profile = oldest ?? (await repos.profiles.create({ name: defaultName }));
  await repos.profiles.setActiveId(profile.id);
  return profile;
}
