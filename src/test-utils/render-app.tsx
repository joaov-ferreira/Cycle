/**
 * Test helper: renders UI inside the real `AppProviders` (store, locale, theme) over
 * in-memory repositories, with the profile's language and onboarding state preset.
 */
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { AppProviders } from '@/components/app-providers';
import { ensureDefaultProfile } from '@/data/bootstrap';
import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import type { Repositories } from '@/data/repositories';
import type { LanguageSetting } from '@/i18n/locale';

export type RenderInAppOptions = {
  language?: LanguageSetting;
  onboarded?: boolean;
  repos?: Repositories;
  /** Runs against the repositories (default profile id given) before the app boots. */
  seed?: (repos: Repositories, profileId: number) => Promise<unknown>;
};

export async function renderInApp(ui: ReactElement, options: RenderInAppOptions = {}) {
  const { language = 'en', onboarded = true, repos = createMemoryRepositories(), seed } = options;
  const profile = await ensureDefaultProfile(repos, 'Default');
  await repos.settings.update(profile.id, { language, onboardingCompleted: onboarded });
  await seed?.(repos, profile.id);
  await render(
    <AppProviders openRepositories={() => Promise.resolve(repos)}>{ui}</AppProviders>,
  );
  return { repos, profileId: profile.id };
}
