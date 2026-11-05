import { useI18n } from '@/i18n';

import { Button, Screen } from '../ui';
import { E1rmSection } from './e1rm-section';
import { LanguageSection } from './language-section';
import { OneRmSection } from './one-rm-section';
import { ProfileSection } from './profile-section';
import { RoundingSection } from './rounding-section';

/** Settings: profiles, 1RMs, increments and rounding, e1RM formula and language. */
export function SettingsScreen({ onBack }: { onBack?: () => void }) {
  const { t } = useI18n();
  return (
    <Screen title={t('settings.title')} testID="screen-settings">
      {onBack ? <Button variant="secondary" label={t('settings.back')} onPress={onBack} /> : null}
      <ProfileSection />
      <OneRmSection />
      <RoundingSection />
      <E1rmSection />
      <LanguageSection />
    </Screen>
  );
}
