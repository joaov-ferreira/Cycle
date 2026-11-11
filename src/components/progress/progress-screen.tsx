import { useT } from '@/i18n';

import { Screen } from '../ui';

/** Placeholder: shows only the localized title until its feature stage replaces it. */
export function ProgressScreen() {
  const t = useT();
  return <Screen title={t('progress.title')} testID="screen-progress" />;
}
