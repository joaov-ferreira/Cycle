import { useI18n } from '@/i18n';

import { DataSection, type DataSectionProps } from '../backup/data-section';
import { Button, Screen } from '../ui';
import { ExperienceSection } from './experience-section';
import { LanguageSection } from './language-section';
import { ProfileSection } from './profile-section';
import { ThemeSection } from './theme-section';
import { ToolsSection } from './tools-section';

export type SettingsScreenProps = DataSectionProps & { onBack?: () => void };

/** Settings: profile, experience level, workout tools, data (backup), theme and language. */
export function SettingsScreen({ onBack, saveFile, pickFile, now }: SettingsScreenProps) {
  const { t } = useI18n();
  return (
    <Screen title={t('settings.title')} testID="screen-settings">
      {onBack ? <Button variant="secondary" label={t('common.back')} onPress={onBack} /> : null}
      <ProfileSection />
      <ExperienceSection />
      <ToolsSection />
      <DataSection saveFile={saveFile} pickFile={pickFile} now={now} />
      <ThemeSection />
      <LanguageSection />
    </Screen>
  );
}
