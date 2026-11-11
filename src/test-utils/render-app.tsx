/**
 * Test helper: renders UI inside the real `AppProviders` (store, locale, theme) over
 * in-memory repositories, with the profile's language and onboarding state preset.
 *
 * Pass `repos` (and optionally a pre-seeded `store` built over them, e.g. with
 * `createTestStore`) to start from existing data, and `now` for a fixed clock. The store is
 * (re)loaded from the repositories after the presets, so what was seeded is what renders.
 */
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { AppProviders } from '@/components/app-providers';
import { ensureDefaultProfile } from '@/data/bootstrap';
import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import type { Repositories } from '@/data/repositories';
import type { LanguageSetting } from '@/i18n/locale';
import { createAppStore } from '@/state/app-store';
import type { AppStore, RestNotifier } from '@/state/types';

export type RenderInAppOptions = {
  language?: LanguageSetting;
  onboarded?: boolean;
  /** The repositories to use; required when `store` is given (the ones it was created over). */
  repos?: Repositories;
  /** A store created over `repos`; its data is reloaded before rendering. */
  store?: AppStore;
  /** Clock for the store (ignored when `store` is given: it already has its own). */
  now?: () => Date;
  /** Rest-end notifier for the store (ignored when `store` is given), e.g. `createFakeNotifier()`. */
  notifier?: RestNotifier;
  /** App version written into backups (ignored when `store` is given). */
  appVersion?: string;
  /** Runs against the repositories (default profile id given) before the app boots. */
  seed?: (repos: Repositories, profileId: number) => Promise<unknown>;
};

export async function renderInApp(ui: ReactElement, options: RenderInAppOptions = {}) {
  const { language = 'en', onboarded = true, seed, now, notifier, appVersion } = options;
  if (options.store && !options.repos) throw new Error('renderInApp: `store` requires its `repos`');
  const repos = options.repos ?? createMemoryRepositories({ clock: now });
  const profile = await ensureDefaultProfile(repos, 'Default');
  await repos.settings.update(profile.id, { language, onboardingCompleted: onboarded });
  await seed?.(repos, profile.id);
  const store = options.store ?? createAppStore(repos, { now, notifier, appVersion });
  await store.getState().init('Default');
  await render(
    <AppProviders
      openRepositories={() => Promise.resolve(repos)}
      store={store}
      notifier={notifier}
      appVersion={appVersion}
    >
      {ui}
    </AppProviders>,
  );
  return { repos, profileId: profile.id, store };
}
