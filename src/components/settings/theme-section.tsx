import type { ThemeSetting } from '@/data/repositories';
import { useT } from '@/i18n';
import { selectColorScheme } from '@/state/app-store';
import { useAppStore } from '@/state/app-store-context';

import { Card, SegmentedControl, Text } from '../ui';

/** Theme selector: Dark / Light, applied instantly. */
export function ThemeSection() {
  const t = useT();
  const theme = useAppStore(selectColorScheme);
  const setTheme = useAppStore((s) => s.setTheme);
  const options: { value: ThemeSetting; label: string }[] = [
    { value: 'dark', label: t('settings.theme.dark') },
    { value: 'light', label: t('settings.theme.light') },
  ];
  return (
    <Card>
      <Text variant="heading">{t('settings.theme.title')}</Text>
      <SegmentedControl
        label={t('settings.theme.label')}
        options={options}
        value={theme}
        onChange={(value) => void setTheme(value)}
      />
    </Card>
  );
}
