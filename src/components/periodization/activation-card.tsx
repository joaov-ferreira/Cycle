import { useState } from 'react';

import { activationIssues, type Periodization } from '@/domain/periodization';
import { useI18n } from '@/i18n';
import { InvalidStartDateError } from '@/state/app-store';
import { useAppStore } from '@/state/app-store-context';

import { Button, Card, Text, TextField } from '../ui';

const UTC_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' };

/** Today in the device's time zone, as `YYYY-MM-DD`. */
function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "Generate/Activate" (SPEC §4.4): saves a snapshot of the periodization with a start date. */
export function ActivationCard({ periodization }: { periodization: Periodization }) {
  const { t, formatDate } = useI18n();
  const active = useAppStore((s) => s.activePeriodization);
  const activate = useAppStore((s) => s.activatePeriodization);
  const [startDate, setStartDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const issues = activationIssues(periodization);

  async function onActivate() {
    setDone(false);
    try {
      await activate(startDate);
      setError(null);
      setDone(true);
    } catch (e) {
      if (!(e instanceof InvalidStartDateError)) throw e;
      setError(t('periodization.activation.invalidDate'));
    }
  }

  return (
    <Card>
      <Text variant="heading">{t('periodization.activation.title')}</Text>
      <Text tone="secondary">{t('periodization.activation.description')}</Text>
      {active ? (
        <>
          <Text variant="label">
            {t('periodization.activation.active', {
              date: formatDate(new Date(`${active.startDate}T00:00:00Z`), UTC_DATE),
            })}
          </Text>
          <Text variant="caption" tone="secondary">
            {t('periodization.activation.activatedOn', { date: formatDate(new Date(active.createdAt)) })}
          </Text>
        </>
      ) : (
        <Text tone="secondary">{t('periodization.activation.none')}</Text>
      )}
      <TextField
        label={t('periodization.activation.startDate')}
        value={startDate}
        onChangeText={(text) => {
          setStartDate(text);
          setError(null);
        }}
        error={error}
      />
      {issues.map((issue) => (
        <Text key={issue} tone="danger">
          {t(`periodization.activation.issues.${issue}`)}
        </Text>
      ))}
      <Button
        label={t('periodization.activation.activate')}
        disabled={issues.length > 0}
        onPress={() => void onActivate()}
      />
      {done ? (
        <Text accessibilityLiveRegion="polite" tone="secondary">
          {t('periodization.activation.done')}
        </Text>
      ) : null}
    </Card>
  );
}
