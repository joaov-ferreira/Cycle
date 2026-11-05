import { useI18n } from '@/i18n';
import type { ProgramSource } from '@/programs/schema';

import { Card, Text } from '../ui';

const SOURCE_DATE: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
};

/** Author, reference, link, access date and notes of a program's source (SPEC §3.1 rule 4). */
export function SourceCard({ source }: { source: ProgramSource }) {
  const { t, formatDate } = useI18n();
  return (
    <Card>
      <Text variant="heading">{t('programs.detail.source')}</Text>
      <Text tone="secondary">{t('programs.detail.author', { author: source.author })}</Text>
      <Text tone="secondary">{t('programs.detail.reference', { reference: source.reference })}</Text>
      {source.url ? <Text tone="secondary">{t('programs.detail.url', { url: source.url })}</Text> : null}
      <Text tone="secondary">
        {t('programs.detail.accessed', {
          date: formatDate(new Date(`${source.accessedAt}T00:00:00Z`), SOURCE_DATE),
        })}
      </Text>
      {source.notes ? <Text tone="secondary">{t('programs.detail.notes', { notes: source.notes })}</Text> : null}
    </Card>
  );
}
