import { useT } from '@/i18n';

import { Screen } from '../ui';

/** Placeholder: shows only the localized title until its feature stage replaces it. */
export function ExerciseNewScreen() {
  const t = useT();
  return <Screen title={t('exercises.newTitle')} testID="screen-exercise-new" />;
}
