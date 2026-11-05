import { useMemo, useState } from 'react';
import { Pressable } from 'react-native';

import { LIFTS, type Lift } from '@/domain/lifts';
import {
  entryE1rm,
  entryTonnageKg,
  filterHistory,
  groupActualSets,
  groupPrescribedSets,
  historyPrograms,
  type HistoryEntry,
} from '@/domain/history';
import { DEFAULT_PERIOD, PERIODS, type Period } from '@/domain/stats';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';
import { selectHistoryEntries } from '@/state/history-selectors';

import { Button, Card, Screen, SegmentedControl, Text } from '../ui';
import { FilterChips } from './filter-chips';
import { useHistoryText } from './history-text';

export type HistoryScreenProps = {
  /** Opens the detail of a completed session (performed session id). */
  onOpen: (performedSessionId: number) => void;
  onBack?: () => void;
  /** The clock for the period filter; defaults to the current time. */
  now?: Date;
};

/** The program line of an entry: `5/3/1 (custom) (version 1.0)`. */
export function useProgramLine() {
  const t = useI18n().t;
  return (entry: Pick<HistoryEntry, 'templateName' | 'templateVersion'>) =>
    entry.templateVersion === null
      ? t('history.item.programNoVersion', { program: entry.templateName })
      : t('history.item.program', { program: entry.templateName, version: entry.templateVersion });
}

function HistoryItem({ entry, onOpen }: { entry: HistoryEntry; onOpen: (id: number) => void }) {
  const { t, formatKg, formatDate } = useI18n();
  const text = useHistoryText();
  const programLine = useProgramLine();
  const date = formatDate(new Date(entry.completedAt));
  const lift = t(`lifts.${entry.lift}`);
  const e1rm = entryE1rm(entry);
  const prescribed = groupPrescribedSets(entry.sets);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('history.item.open', { lift, date })}
      onPress={() => onOpen(entry.id)}>
      <Card testID={`history-item-${entry.id}`}>
        <Text variant="heading">{t('history.item.heading', { date, lift })}</Text>
        <Text>{programLine(entry)}</Text>
        <Text tone="secondary">{t('history.item.session', { number: entry.sessionNumber, week: entry.blockWeek })}</Text>
        {prescribed.length > 0 ? (
          <Text tabular tone="secondary">
            {t('history.item.prescribed', { groups: text.prescribed(prescribed) })}
          </Text>
        ) : null}
        <Text tabular>{t('history.item.performed', { groups: text.performed(groupActualSets(entry.sets)) })}</Text>
        <Text tabular tone="secondary">
          {t('history.item.tonnage', { tonnage: formatKg(entryTonnageKg(entry)) })}
        </Text>
        <Text tabular variant="label">
          {e1rm
            ? t('e1rm.estimate', { value: formatKg(e1rm.valueKg, { maximumFractionDigits: 1 }) })
            : t('history.item.noE1rm')}
        </Text>
        {entry.editedAt ? (
          <Text variant="caption" tone="secondary">
            {t('history.item.edited', { date: formatDate(new Date(entry.editedAt)) })}
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}

/**
 * Training history (SPEC §10): completed sessions, newest first, filterable by lift, program and
 * period. Each item opens the session detail.
 */
export function HistoryScreen({ onOpen, onBack, now: nowOverride }: HistoryScreenProps) {
  const { t } = useI18n();
  const entries = useAppStore(selectHistoryEntries);
  const [lift, setLift] = useState<Lift | 'all'>('all');
  const [templateId, setTemplateId] = useState('all');
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  // the clock is read when the period changes, so reopening a period refreshes it
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => nowOverride ?? new Date(), [nowOverride, period]);
  const programs = useMemo(() => historyPrograms(entries), [entries]);
  const visible = useMemo(
    () =>
      filterHistory(
        entries,
        {
          ...(lift === 'all' ? {} : { lift }),
          ...(templateId === 'all' ? {} : { templateId }),
          period,
        },
        now,
      ),
    [entries, lift, templateId, period, now],
  );
  return (
    <Screen title={t('history.title')} testID="screen-history">
      {onBack ? <Button variant="secondary" label={t('history.back')} onPress={onBack} /> : null}
      <Text tone="secondary">{t('history.intro')}</Text>
      <FilterChips
        label={t('history.filters.lift')}
        options={[
          { value: 'all', label: t('history.filters.allLifts') },
          ...LIFTS.map((value) => ({ value, label: t(`lifts.${value}`) })),
        ]}
        value={lift}
        onChange={setLift}
      />
      {programs.length > 1 || templateId !== 'all' ? (
        <FilterChips
          label={t('history.filters.program')}
          options={[
            { value: 'all', label: t('history.filters.allPrograms') },
            ...programs.map((program) => ({ value: program.templateId, label: program.templateName })),
          ]}
          value={templateId}
          onChange={setTemplateId}
        />
      ) : null}
      <SegmentedControl
        label={t('history.filters.period')}
        options={PERIODS.map((value) => ({ value, label: t(`progress.periods.${value}`) }))}
        value={period}
        onChange={setPeriod}
      />
      {entries.length === 0 ? (
        <Text tone="secondary">{t('history.empty')}</Text>
      ) : (
        <>
          <Text variant="label" accessibilityLiveRegion="polite">
            {t('history.count', { count: visible.length })}
          </Text>
          {visible.length === 0 ? <Text tone="secondary">{t('history.noMatch')}</Text> : null}
          {visible.map((entry) => (
            <HistoryItem key={entry.id} entry={entry} onOpen={onOpen} />
          ))}
        </>
      )}
    </Screen>
  );
}
