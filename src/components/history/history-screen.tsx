import { useT } from '@/i18n';

import { Screen } from '../ui';

/** Placeholder: shows only the localized title until its feature stage replaces it. */
export function HistoryScreen() {
  const t = useT();
  return <Screen title={t('history.title')} testID="screen-history" />;
}
