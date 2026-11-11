import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';
import {
  programDay,
  resolveParams,
  type ConfigurableParam,
  type ProgramFamily,
  type ProgramLink,
  type ProgramTemplate,
} from '@/domain/program';
import { useI18n, type MessageKey } from '@/i18n';
import { programsByFamily } from '@/library';

import { Stepper } from '../../shared';
import { useTheme } from '../../theme-provider';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { NumberInput } from '../../ui/NumberInput';
import { Text } from '../../ui/Text';
import { defaultBlock, displayToParam, hasAccessories, paramToDisplay, withParam, withRole } from './block-ops';
import { useEditorContext } from './editor-context';
import { ToggleChip } from './percent-editor';
import { localText } from '../prescription-text';

const FAMILY_LABEL: Record<ProgramFamily, MessageKey> = {
  '531-custom': 'planEditor.block.family531',
  'smolov-jr': 'planEditor.block.familySmolovJr',
  smolov: 'planEditor.block.familySmolov',
  sheiko: 'planEditor.block.familySheiko',
};

export type ProgramBlockFormProps = {
  /** The block being edited; `null` creates a new one with the id `newId`. */
  block: ProgramLink | null;
  newId: string;
  /** Program lookup; the form never reads the library itself for a block's program. */
  findProgram: (id: string) => ProgramTemplate | undefined;
  onSave: (block: ProgramLink) => void;
  onCancel: () => void;
};

/**
 * Inline form of a program block (SPEC-v4 §10.3): program → day → start week → exercises for the
 * program's roles → parameters → accessories. The block is applied on "Save block" only.
 */
export function ProgramBlockForm({ block, newId, findProgram, onSave, onCancel }: ProgramBlockFormProps) {
  const { t, locale, formatNumber, formatKg } = useI18n();
  const { exerciseLabel, exerciseExists, pickExercise } = useEditorContext();
  const [link, setLink] = useState<ProgramLink | null>(block);
  const [choosing, setChoosing] = useState(block === null || findProgram(block.programId) === undefined);
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set());
  const program = link ? findProgram(link.programId) : undefined;

  const choose = (next: ProgramTemplate) => {
    setChoosing(false);
    setInvalid(new Set());
    if (link?.programId !== next.id) setLink(defaultBlock(link?.id ?? newId, next, exerciseExists));
  };
  const markInvalid = (key: string, isInvalid: boolean) =>
    setInvalid((current) => {
      if (current.has(key) === isInvalid) return current;
      const copy = new Set(current);
      if (isInvalid) copy.add(key);
      else copy.delete(key);
      return copy;
    });

  const mapped = link ? Object.keys(link.roles).length : 0;
  const canSave = link !== null && program !== undefined && mapped > 0 && invalid.size === 0;

  return (
    <Card testID="program-block-form" style={styles.form}>
      <Text variant="label" accessibilityRole="header">
        {t('planEditor.block.formTitle')}
      </Text>

      {choosing || !program ? (
        <ProgramChooser selectedId={link?.programId} onChoose={choose} />
      ) : (
        <View style={styles.row}>
          <Text variant="label">{t('planEditor.block.program')}</Text>
          <Text>{program.name}</Text>
          <Button variant="secondary" label={t('planEditor.block.changeProgram')} onPress={() => setChoosing(true)} />
        </View>
      )}

      {link && program && !choosing ? (
        <>
          <View style={styles.field}>
            <Text variant="label">{t('planEditor.block.day')}</Text>
            <View style={styles.row}>
              <Stepper
                label={t('planEditor.block.dayOf')}
                value={link.day}
                min={1}
                max={program.daysPerWeek}
                onChange={(day) => setLink({ ...link, day })}
              />
              {(() => {
                const label = programDay(program, 1, link.day)?.label;
                return label ? <Text tone="secondary">{localText(label, locale)}</Text> : null;
              })()}
            </View>
          </View>

          {program.durationWeeks > 1 ? (
            <View style={styles.field}>
              <Text variant="label">{t('planEditor.block.startWeek')}</Text>
              <Stepper
                label={t('planEditor.block.startWeekOf')}
                value={link.startWeek}
                min={1}
                max={program.durationWeeks}
                onChange={(startWeek) => setLink({ ...link, startWeek })}
              />
              <Text variant="caption" tone="secondary">
                {t('planEditor.block.startWeekHint')}
              </Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text variant="label" accessibilityRole="header">
              {t('planEditor.block.roles')}
            </Text>
            {program.roles.map((role) => {
              const exerciseId = link.roles[role.id];
              const roleName = localText(role.label, locale);
              const departs =
                role.fixedInOriginal === true &&
                exerciseId !== undefined &&
                role.defaultExerciseId !== undefined &&
                exerciseId !== role.defaultExerciseId;
              return (
                <View key={role.id} style={styles.field} testID={`block-role-${role.id}`}>
                  <Text variant="label">{roleName}</Text>
                  <View style={styles.row}>
                    <Text tone={exerciseId ? 'primary' : 'secondary'}>
                      {exerciseId ? exerciseLabel(exerciseId) : t('planEditor.block.noExercise')}
                    </Text>
                    <Button
                      variant="secondary"
                      label={t('planEditor.block.chooseExercise')}
                      accessibilityLabel={t('planEditor.block.chooseFor', { role: roleName })}
                      onPress={() =>
                        pickExercise({
                          title: t('planEditor.block.pickerTitle', { role: roleName }),
                          onSelect: (id) => setLink((current) => (current ? withRole(current, role.id, id) : current)),
                        })
                      }
                    />
                    {exerciseId ? (
                      <Button
                        variant="secondary"
                        label={t('planEditor.block.clearRole')}
                        accessibilityLabel={t('planEditor.block.clearFor', { role: roleName })}
                        onPress={() => setLink(withRole(link, role.id, undefined))}
                      />
                    ) : null}
                  </View>
                  {departs ? (
                    <Text variant="caption" tone="secondary">
                      {t('planEditor.block.notOriginal', { exercise: exerciseLabel(role.defaultExerciseId as string) })}
                    </Text>
                  ) : null}
                </View>
              );
            })}
            {mapped === 0 ? (
              <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
                {t('planEditor.block.needRole')}
              </Text>
            ) : null}
          </View>

          {program.configurable && program.configurable.length > 0 ? (
            <View style={styles.field}>
              <Text variant="label" accessibilityRole="header">
                {t('planEditor.block.params')}
              </Text>
              {program.configurable.map((param) => (
                <ParamField
                  key={`${program.id}:${param.id}`}
                  param={param}
                  value={resolveParams(program, link.params)[param.id]}
                  onInvalid={markInvalid}
                  onValue={(value) => setLink((current) => (current ? withParam(current, param.id, value) : current))}
                  format={(value) =>
                    param.unit === 'fraction'
                      ? `${formatNumber(paramToDisplay(param, value))} ${t('planEditor.block.percentUnit')}`
                      : formatKg(value, { minimumFractionDigits: 0 })
                  }
                />
              ))}
            </View>
          ) : null}

          {hasAccessories(program) ? (
            <ToggleChip
              label={t('planEditor.block.accessories')}
              accessibilityLabel={t('planEditor.block.accessories')}
              checked={link.accessories}
              onChange={(accessories) => setLink({ ...link, accessories })}
            />
          ) : null}
        </>
      ) : null}

      <View style={styles.row}>
        <Button variant="secondary" label={t('common.cancel')} onPress={onCancel} />
        <Button
          label={t('planEditor.block.save')}
          disabled={!canSave}
          onPress={() => link && onSave(link)}
        />
      </View>
    </Card>
  );
}

function ProgramChooser({ selectedId, onChoose }: { selectedId: string | undefined; onChoose: (p: ProgramTemplate) => void }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <View style={styles.field} accessibilityLabel={t('planEditor.block.chooseProgram')}>
      <Text variant="label" accessibilityRole="header">
        {t('planEditor.block.chooseProgram')}
      </Text>
      {programsByFamily().map((group) => (
        <View key={group.family} style={styles.field}>
          <Text variant="caption" tone="secondary">
            {t(FAMILY_LABEL[group.family])}
          </Text>
          {group.programs.map((program) => {
            const selected = program.id === selectedId;
            return (
              <Pressable
                key={program.id}
                testID={`program-option-${program.id}`}
                accessibilityRole="button"
                accessibilityLabel={program.name}
                accessibilityState={{ selected }}
                onPress={() => onChoose(program)}
                style={[
                  styles.option,
                  {
                    backgroundColor: selected ? colors.surfaceRaised : colors.surface,
                    borderColor: selected ? colors.accent : colors.border,
                  },
                ]}>
                <Text variant="label">{program.name}</Text>
                <Text variant="caption" tone="secondary">
                  {t('planEditor.block.programMeta', {
                    weeks: t('planEditor.block.weeks', { count: program.durationWeeks }),
                    days: t('planEditor.block.days', { count: program.daysPerWeek }),
                  })}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

type ParamFieldProps = {
  param: ConfigurableParam;
  /** The value in effect (the override or the default). */
  value: number;
  onInvalid: (key: string, invalid: boolean) => void;
  onValue: (value: number) => void;
  format: (value: number) => string;
};

/** One configurable parameter: fractions of the 1RM are edited as percentages. */
function ParamField({ param, value, onInvalid, onValue, format }: ParamFieldProps) {
  const { t, locale } = useI18n();
  const rules = {
    required: true,
    min: paramToDisplay(param, param.min),
    max: paramToDisplay(param, param.max),
    ...(param.step === undefined ? {} : { step: paramToDisplay(param, param.step) }),
    maxDecimals: param.unit === 'fraction' ? 2 : 3,
  };
  return (
    <View style={styles.field}>
      <NumberInput
        label={localText(param.label, locale)}
        unit={param.unit === 'fraction' ? t('planEditor.block.percentUnit') : t('common.kg')}
        value={paramToDisplay(param, value)}
        rules={rules}
        onChange={({ value: next, error }) => {
          onInvalid(param.id, error !== null);
          if (error === null && next !== null) onValue(displayToParam(param, next));
        }}
      />
      <Text variant="caption" tone="secondary">
        {t('planEditor.block.paramDefault', { value: format(param.default) })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  field: { gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  option: {
    minHeight: layout.minTouchTarget,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs / 2,
  },
});
