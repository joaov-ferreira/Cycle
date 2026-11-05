import { useI18n } from '@/i18n';

import { Button, Screen } from '../ui';
import { LanguageSection } from './language-section';
import { OneRmSection } from './one-rm-section';
import { ProfileSection } from './profile-section';

/** Settings: profiles, 1RMs and language. (Increments arrive in a later stage.) */
export function SettingsScreen({ onBack }: { onBack?: () => void }) {
  const { t } = useI18n();
  return (
    <Screen title={t('settings.title')} testID="screen-settings">
      {onBack ? <Button variant="secondary" label={t('settings.back')} onPress={onBack} /> : null}
      <ProfileSection />
      <OneRmSection />
      <LanguageSection />
    </Screen>
  );
}
