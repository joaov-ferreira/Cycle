import { useI18n } from '@/i18n';

import { Button, Screen } from '../ui';
import { ExperienceSection } from './experience-section';
import { LanguageSection } from './language-section';
import { ProfileSection } from './profile-section';
import { ThemeSection } from './theme-section';

/** Settings: profile, experience level, theme and language. */
export function SettingsScreen({ onBack }: { onBack?: () => void }) {
  const { t } = useI18n();
  return (
    <Screen title={t('settings.title')} testID="screen-settings">
      {onBack ? <Button variant="secondary" label={t('common.back')} onPress={onBack} /> : null}
      <ProfileSection />
      <ExperienceSection />
      <ThemeSection />
      <LanguageSection />
    </Screen>
  );
}
