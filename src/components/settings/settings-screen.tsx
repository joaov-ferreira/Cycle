import { useI18n } from '@/i18n';

import { Button, Screen } from '../ui';
import { LanguageSection } from './language-section';
import { OneRmSection } from './one-rm-section';
import { ProfileSection } from './profile-section';
import { RoundingSection } from './rounding-section';

/** Settings: profiles, 1RMs, increments and rounding, and language. */
export function SettingsScreen({ onBack }: { onBack?: () => void }) {
  const { t } = useI18n();
  return (
    <Screen title={t('settings.title')} testID="screen-settings">
      {onBack ? <Button variant="secondary" label={t('settings.back')} onPress={onBack} /> : null}
      <ProfileSection />
      <OneRmSection />
      <RoundingSection />
      <LanguageSection />
    </Screen>
  );
}
