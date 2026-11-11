import { EXPERIENCE_LEVELS, suggestCycle, type Experience } from '@/domain/cycle';
import { useT, type MessageKey } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';

import { Card, SegmentedControl, Text } from '../ui';

const LABEL_KEYS = {
  beginner: 'settings.experience.beginner',
  intermediate: 'settings.experience.intermediate',
  advanced: 'settings.experience.advanced',
} as const satisfies Record<Experience, MessageKey>;

/** Experience level (SPEC §5.1): sets the suggested load/deload cycle, applied instantly. */
export function ExperienceSection() {
  const t = useT();
  const experience = useAppStore((s) => s.settings?.experience ?? 'intermediate');
  const setExperience = useAppStore((s) => s.setExperience);
  const options = EXPERIENCE_LEVELS.map((level) => ({ value: level, label: t(LABEL_KEYS[level]) }));
  const cycle = suggestCycle(experience);
  return (
    <Card>
      <Text variant="heading">{t('settings.experience.title')}</Text>
      <SegmentedControl
        label={t('settings.experience.label')}
        options={options}
        value={experience}
        onChange={(value) => void setExperience(value)}
      />
      <Text tone="secondary" variant="caption">
        {t('settings.experience.hint', { loadWeeks: cycle.loadWeeks, deloadWeeks: cycle.deloadWeeks })}
      </Text>
    </Card>
  );
}
