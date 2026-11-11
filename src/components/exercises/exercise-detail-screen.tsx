import { useT } from '@/i18n';

import { Screen } from '../ui';

/** Placeholder: shows only the localized title until its feature stage replaces it. */
export function ExerciseDetailScreen() {
  const t = useT();
  return <Screen title={t('exercises.detailTitle')} testID="screen-exercise-detail" />;
}
