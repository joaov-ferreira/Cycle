import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { LIFTS, type Lift } from '@/domain/lifts';
import type { SessionSlotConfig } from '@/domain/periodization';
import { changeSlotLift, changeSlotTemplate, type SessionSlotInput } from '@/domain/session-slots';
import { useI18n } from '@/i18n';
import { maxBlockStartWeek } from '@/programs/blocks';
import { pickLocalized } from '@/programs/localized';
import type { ParamValues } from '@/programs/params';
import { groupByFamily } from '@/programs/registry';
import type { ConfigurableParam, ProgramFamily, ProgramTemplate } from '@/programs/schema';

import { Button, Card, NumberInput, SegmentedControl, Text } from '../ui';

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
  /** Values in effect for the slot program's parameters (shared by every slot of that program). */
  paramValues: ParamValues;
  /** Called only with values inside the parameter's range and step. */
  onParamChange: (templateId: string, paramId: string, value: number) => void;
  /** "Add all days of this program"; null when every day of the program is already covered. */
  onAddAllDays: (() => void) | null;
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
  paramValues,
  onParamChange,
  onAddAllDays,
}: SlotEditorProps) {
  const { t, locale, formatKg } = useI18n();
  const { id: _id, ...input } = slot;
  const template = templates.find((candidate) => candidate.id === slot.templateId);
  const families = groupByFamily(templates.filter((candidate) => candidate.allowedLifts.includes(slot.lift)));
  const family = families.find((group) => group.family === template?.family);
  const maxStart = template ? maxBlockStartWeek(template) : 1;
  const kgParams = (template?.configurable ?? []).filter((param) => param.unit === 'kg');
  const kgRules = (param: ConfigurableParam) => ({
    required: true,
    min: param.min,
    max: param.max,
    step: param.step,
    maxDecimals: 2,
  });

  return (
    <Card testID={`slot-${slot.id}`}>
      <Text variant="heading">{t('periodization.slot.title', { number })}</Text>
      <SegmentedControl<Lift>
        label={t('periodization.slot.lift', { number })}
        options={LIFTS.map((lift) => ({ value: lift, label: t(`lifts.${lift}`) }))}
        value={slot.lift}
        onChange={(lift) => onChange(changeSlotLift(input, lift, templates))}
      />
      <SegmentedControl<ProgramFamily>
        label={t('periodization.slot.program', { number })}
        options={families.map((group) => ({
          value: group.family,
          // a family with one template shows its name; one with several (Sheiko) its family name
          label: group.templates.length === 1 ? group.templates[0].name : t(`programs.family.${group.family}`),
        }))}
        value={family?.family ?? ('' as ProgramFamily)}
        onChange={(next) => {
          const first = families.find((group) => group.family === next)?.templates[0];
          if (first) onChange(changeSlotTemplate(input, first.id, templates));
        }}
      />
      {family && family.templates.length > 1 ? (
        <SegmentedControl
          label={t('periodization.slot.template', { number })}
          options={family.templates.map((candidate) => ({ value: candidate.id, label: candidate.variant ?? candidate.name }))}
          value={slot.templateId}
          onChange={(templateId) => onChange(changeSlotTemplate(input, templateId, templates))}
        />
      ) : null}
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
      {template
        ? kgParams.map((param) => (
            <View key={param.id} style={styles.param}>
              <NumberInput
                label={t('periodization.slot.param', { param: pickLocalized(param.label, locale), number })}
                unit={t('periodization.slot.paramUnit')}
                value={paramValues[param.id] ?? param.default}
                rules={kgRules(param)}
                onChange={(change) => {
                  if (change.value !== null) onParamChange(template.id, param.id, change.value);
                }}
              />
              <Text variant="caption" tone="secondary">
                {t('periodization.slot.paramRange', {
                  min: formatKg(param.min),
                  max: formatKg(param.max),
                  step: formatKg(param.step ?? 0),
                  program: template.name,
                })}
              </Text>
            </View>
          ))
        : null}
      {template && onAddAllDays ? (
        <Button
          variant="secondary"
          label={t('periodization.slot.addAllDays')}
          accessibilityLabel={t('periodization.slot.addAllDaysFor', { program: template.name, number })}
          onPress={onAddAllDays}
        />
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
  param: { gap: spacing.xs },
});
