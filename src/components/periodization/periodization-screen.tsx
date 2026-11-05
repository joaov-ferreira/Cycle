import { useMemo, useState } from 'react';

import { useT } from '@/i18n';
import { listTemplates } from '@/programs/registry';
import { useAppStore } from '@/state/app-store-context';
import { selectPeriodization } from '@/state/periodization-selectors';

import { Button, Screen, SegmentedControl, Text } from '../ui';
import { ActivationCard } from './activation-card';
import { PeriodizationCalendar } from './periodization-calendar';
import { PeriodizationTable } from './periodization-table';
import { PeriodizationWarnings } from './periodization-warnings';
import { SlotEditor } from './slot-editor';

export type PeriodizationScreenProps = {
  /** Opens a program's detail (its configurable parameters). */
  onOpenProgram: (templateId: string) => void;
  /** Opens a session's detail by its key (`<slotId>-w<blockWeek>`). */
  onOpenSession: (sessionKey: string) => void;
};

type View = 'table' | 'calendar';

/**
 * Periodization (SPEC §4, §6): the session-slot editor, warnings, the Table | Calendar views and
 * activation. Both views read the memoized `selectPeriodization`, so any change to slots, 1RMs,
 * rounding or program parameters shows up immediately.
 */
export function PeriodizationScreen({ onOpenProgram, onOpenSession }: PeriodizationScreenProps) {
  const t = useT();
  const [view, setView] = useState<View>('table');
  const templates = useMemo(() => listTemplates(), []);
  const slots = useAppStore((s) => s.sessionSlots);
  const periodization = useAppStore(selectPeriodization);
  const addSessionSlot = useAppStore((s) => s.addSessionSlot);
  const updateSessionSlot = useAppStore((s) => s.updateSessionSlot);
  const duplicateSessionSlot = useAppStore((s) => s.duplicateSessionSlot);
  const removeSessionSlot = useAppStore((s) => s.removeSessionSlot);
  const moveSessionSlot = useAppStore((s) => s.moveSessionSlot);

  return (
    <Screen title={t('screens.periodization.title')} testID="screen-periodization">
      <Text tone="secondary">{t('periodization.intro')}</Text>
      <Text variant="heading">{t('periodization.sessions')}</Text>
      {slots.length === 0 ? <Text tone="secondary">{t('periodization.empty')}</Text> : null}
      {slots.map((slot, index) => (
        <SlotEditor
          key={slot.id}
          slot={slot}
          number={index + 1}
          isFirst={index === 0}
          isLast={index === slots.length - 1}
          templates={templates}
          onChange={(input) => void updateSessionSlot(slot.id, input)}
          onMove={(offset) => void moveSessionSlot(slot.id, offset)}
          onDuplicate={() => void duplicateSessionSlot(slot.id)}
          onRemove={() => void removeSessionSlot(slot.id)}
          onOpenProgram={onOpenProgram}
        />
      ))}
      <Button variant="secondary" label={t('periodization.add')} onPress={() => void addSessionSlot('bench')} />
      <PeriodizationWarnings warnings={periodization.warnings} />
      <SegmentedControl
        label={t('periodization.view.label')}
        options={[
          { value: 'table', label: t('periodization.view.table') },
          { value: 'calendar', label: t('periodization.view.calendar') },
        ]}
        value={view}
        onChange={setView}
      />
      {view === 'table' ? (
        <PeriodizationTable periodization={periodization} />
      ) : (
        <PeriodizationCalendar periodization={periodization} onOpenSession={onOpenSession} />
      )}
      <ActivationCard periodization={periodization} />
    </Screen>
  );
}
