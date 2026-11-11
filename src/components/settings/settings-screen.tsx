import { useI18n } from '@/i18n';

import { Button, Screen } from '../ui';
import { LanguageSection } from './language-section';
import { ProfileSection } from './profile-section';
import { ThemeSection } from './theme-section';

/** Settings: profile, theme and language. */
export function SettingsScreen({ onBack }: { onBack?: () => void }) {
  const { t } = useI18n();
  return (
    <Screen title={t('settings.title')} testID="screen-settings">
      {onBack ? <Button variant="secondary" label={t('common.back')} onPress={onBack} /> : null}
      <ProfileSection />
      <ThemeSection />
      <LanguageSection />
    </Screen>
  );
}
