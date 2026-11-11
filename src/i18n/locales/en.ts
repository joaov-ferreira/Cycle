/**
 * English UI catalog — the SOURCE catalog, composed from the per-namespace files in `./en/`.
 * Every other locale is typed against it, so a missing or extra key in another catalog is a type
 * error (see README "Internationalization").
 *
 * Plural messages are objects with exactly `one` and `other`; `{{name}}` is a placeholder.
 */
import { app } from './en/app';
import { tabs } from './en/tabs';
import { navigation } from './en/navigation';
import { common } from './en/common';
import { home } from './en/home';
import { plan } from './en/plan';
import { planImport } from './en/planImport';
import { workout } from './en/workout';
import { history } from './en/history';
import { progress } from './en/progress';
import { exercises } from './en/exercises';
import { picker } from './en/picker';
import { onboarding } from './en/onboarding';
import { settings } from './en/settings';
import { profile } from './en/profile';
import { validation } from './en/validation';

export const en = {
  app,
  tabs,
  navigation,
  common,
  home,
  plan,
  planImport,
  workout,
  history,
  progress,
  exercises,
  picker,
  onboarding,
  settings,
  profile,
  validation,
};

export type Catalog = typeof en;
