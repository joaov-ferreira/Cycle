import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { LIFTS, type Lift } from '@/domain/lifts';
import type { SessionSlotConfig } from '@/domain/periodization';
import { changeSlotLift, changeSlotTemplate, type SessionSlotInput } from '@/domain/session-slots';
import { useT } from '@/i18n';
import { maxBlockStartWeek } from '@/programs/blocks';
import type { ProgramTemplate } from '@/programs/schema';

import { Button, Card, SegmentedControl, Text } from '../ui';

export type SlotEditorProps = {
  slot: SessionSlotConfig;
  /** 1-based session number. */
  number: number;
  isFirst: boolean;
  isLast: boolean;
  /** Templates the slot may choose from (the program database). */
  templates: readonly ProgramTemplate[];
  onChange: (input: SessionSlotInput) => void;
  onMove: (offset: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onOpenProgram: (templateId: string) => void;
};

/**
 * Editor of one session slot (SPEC §4.1): lift → program (filtered by lift) → program day
 * (when the program has several) → block start week (when it is longer than a block), plus
 * reorder, duplicate and remove actions.
 */
export function SlotEditor({
  slot,
  number,
  isFirst,
  isLast,
  templates,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
  onOpenProgram,
}: SlotEditorProps) {
  const t = useT();
  const { id: _id, ...input } = slot;
  const template = templates.find((candidate) => candidate.id === slot.templateId);
  const forLift = templates.filter((candidate) => candidate.allowedLifts.includes(slot.lift));
  const maxStart = template ? maxBlockStartWeek(template) : 1;

  return (
    <Card testID={`slot-${slot.id}`}>
      <Text variant="heading">{t('periodization.slot.title', { number })}</Text>
      <SegmentedControl<Lift>
        label={t('periodization.slot.lift', { number })}
        options={LIFTS.map((lift) => ({ value: lift, label: t(`lifts.${lift}`) }))}
        value={slot.lift}
        onChange={(lift) => onChange(changeSlotLift(input, lift, templates))}
      />
      <SegmentedControl
        label={t('periodization.slot.program', { number })}
        options={forLift.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
        value={slot.templateId}
        onChange={(templateId) => onChange(changeSlotTemplate(input, templateId, templates))}
      />
      {template && template.daysPerWeek > 1 ? (
        <SegmentedControl
          label={t('periodization.slot.day', { number })}
          options={Array.from({ length: template.daysPerWeek }, (_, i) => ({
            value: String(i + 1),
            label: t('periodization.slot.dayOption', { day: i + 1 }),
          }))}
          value={String(slot.programDay)}
          onChange={(day) => onChange({ ...input, programDay: Number(day) })}
        />
      ) : null}
      {template && template.durationWeeks > 3 ? (
        <View style={styles.row}>
          <Button
            variant="secondary"
            label="−"
            accessibilityLabel={t('periodization.slot.earlier', { number })}
            disabled={slot.startWeek <= 1}
            onPress={() => onChange({ ...input, startWeek: slot.startWeek - 1 })}
          />
          <Text style={styles.grow} tabular>
            {t('periodization.slot.startWeek', { week: slot.startWeek, total: template.durationWeeks })}
          </Text>
          <Button
            variant="secondary"
            label="+"
            accessibilityLabel={t('periodization.slot.later', { number })}
            disabled={slot.startWeek >= maxStart}
            onPress={() => onChange({ ...input, startWeek: slot.startWeek + 1 })}
          />
        </View>
      ) : null}
      <View style={styles.actions}>
        {template?.configurable?.length ? (
          <Button
            variant="secondary"
            label={t('periodization.slot.programSettings')}
            accessibilityLabel={t('periodization.slot.programSettingsFor', { program: template.name })}
            onPress={() => onOpenProgram(template.id)}
          />
        ) : null}
        <Button
          variant="secondary"
          label="↑"
          accessibilityLabel={t('periodization.slot.moveUp', { number })}
          disabled={isFirst}
          onPress={() => onMove(-1)}
        />
        <Button
          variant="secondary"
          label="↓"
          accessibilityLabel={t('periodization.slot.moveDown', { number })}
          disabled={isLast}
          onPress={() => onMove(1)}
        />
        <Button
          variant="secondary"
          label={t('periodization.slot.duplicate')}
          accessibilityLabel={t('periodization.slot.duplicateFor', { number })}
          onPress={onDuplicate}
        />
        <Button
          variant="secondary"
          label={t('periodization.slot.remove')}
          accessibilityLabel={t('periodization.slot.removeFor', { number })}
          onPress={onRemove}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1, textAlign: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
