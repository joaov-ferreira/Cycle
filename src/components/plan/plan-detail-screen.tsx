import { useT } from '@/i18n';

import { Screen } from '../ui';

/** Placeholder: shows only the localized title until its feature stage replaces it. */
export function PlanDetailScreen() {
  const t = useT();
  return <Screen title={t('plan.detailTitle')} testID="screen-plan-detail" />;
}
