import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { spacing } from '@/constants/theme';
import { LIFTS, type Lift } from '@/domain/lifts';
import { useI18n } from '@/i18n';
import { selectCurrentOneRm, type OneRmValues } from '@/state/app-store';
import { useAppStore } from '@/state/app-store-context';

import { OneRmForm } from '../one-rm/one-rm-form';
import { Card, Text } from '../ui';

function LiftHistory({ lift }: { lift: Lift }) {
  const { t, formatDate, formatKg } = useI18n();
  const all = useAppStore((s) => s.oneRmHistory);
  const history = useMemo(() => all.filter((record) => record.lift === lift), [all, lift]);
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label">{`${t(`lifts.${lift}`)} · ${t('oneRm.history')}`}</Text>
      <View testID={`history-${lift}`}>
        {history.length === 0 ? (
          <Text tone="secondary">{t('oneRm.noHistory')}</Text>
        ) : (
          history.map((record) => (
            <Text key={record.id} tone="secondary" tabular>
              {t('oneRm.historyEntry', {
                date: formatDate(new Date(record.effectiveAt)),
                value: formatKg(record.value),
                origin: t(`oneRm.origin.${record.origin}`),
              })}
            </Text>
          ))
        )}
      </View>
    </View>
  );
}

/** Settings → 1RMs: edit the current values (appending records) and browse the history. */
export function OneRmSection() {
  const { t } = useI18n();
  const profileId = useAppStore((s) => s.profile?.id);
  const history = useAppStore((s) => s.oneRmHistory);
  const bench = useAppStore(selectCurrentOneRm('bench'));
  const squat = useAppStore(selectCurrentOneRm('squat'));
  const deadlift = useAppStore(selectCurrentOneRm('deadlift'));
  const save = useAppStore((s) => s.saveReferenceOneRms);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function submit(values: OneRmValues) {
    const count = await save(values, 'manual');
    setFeedback(count === 0 ? t('oneRm.nothingChanged') : t('oneRm.saved', { count }));
  }

  return (
    <Card>
      <Text variant="heading">{t('settings.oneRms.title')}</Text>
      <Text tone="secondary">{t('settings.oneRms.description')}</Text>
      <OneRmForm
        key={`${profileId}:${history.length}`}
        initial={{ bench: bench?.value ?? null, squat: squat?.value ?? null, deadlift: deadlift?.value ?? null }}
        submitLabel={t('oneRm.save')}
        onSubmit={(values) => void submit(values)}
      />
      {feedback ? (
        <Text tone="accent" accessibilityLiveRegion="polite">
          {feedback}
        </Text>
      ) : null}
      {LIFTS.map((lift) => (
        <LiftHistory key={lift} lift={lift} />
      ))}
    </Card>
  );
}
