import { useT } from '@/i18n';
import type { LanguageSetting } from '@/i18n/locale';
import { selectLanguageSetting } from '@/state/app-store';
import { useAppStore } from '@/state/app-store-context';

import { Card, SegmentedControl, Text } from '../ui';

/** Language selector: System / English / Português, applied instantly (SPEC §11.1). */
export function LanguageSection() {
  const t = useT();
  const language = useAppStore(selectLanguageSetting);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const options: { value: LanguageSetting; label: string }[] = [
    { value: 'system', label: t('settings.language.system') },
    { value: 'en', label: t('settings.language.en') },
    { value: 'pt-BR', label: t('settings.language.ptBR') },
  ];
  return (
    <Card>
      <Text variant="heading">{t('settings.language.title')}</Text>
      <SegmentedControl
        label={t('settings.language.label')}
        options={options}
        value={language}
        onChange={(value) => void setLanguage(value)}
      />
    </Card>
  );
}
