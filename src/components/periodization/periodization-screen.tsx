import { useMemo } from 'react';

import { useT } from '@/i18n';
import { listTemplates } from '@/programs/registry';
import { useAppStore } from '@/state/app-store-context';
import { selectPeriodization } from '@/state/periodization-selectors';

import { Button, Screen, Text } from '../ui';
import { ActivationCard } from './activation-card';
import { PeriodizationTable } from './periodization-table';
import { PeriodizationWarnings } from './periodization-warnings';
import { SlotEditor } from './slot-editor';

export type PeriodizationScreenProps = {
  /** Opens a program's detail (its configurable parameters). */
  onOpenProgram: (templateId: string) => void;
};

/**
 * Periodization (SPEC §4, §6-A): the session-slot editor, warnings, the three-week table and
 * activation. The table reads the memoized `selectPeriodization`, so any change to slots, 1RMs,
 * rounding or program parameters shows up immediately.
 */
export function PeriodizationScreen({ onOpenProgram }: PeriodizationScreenProps) {
  const t = useT();
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
      <PeriodizationTable periodization={periodization} />
      <ActivationCard periodization={periodization} />
    </Screen>
  );
}
