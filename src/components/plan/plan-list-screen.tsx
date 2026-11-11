import { useT } from '@/i18n';

import { Screen } from '../ui';

/** Placeholder: shows only the localized title until its feature stage replaces it. */
export function PlanListScreen() {
  const t = useT();
  return <Screen title={t('plan.listTitle')} testID="screen-plan-list" />;
}
