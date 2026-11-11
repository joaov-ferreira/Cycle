import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { PLAN_LIMITS } from '@/domain/plan';
import type { ProgramLink, ProgramTemplate } from '@/domain/program';
import { useI18n } from '@/i18n';

import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { useEditorContext } from './editor-context';
import { IconButton } from './icon-button';
import { ProgramBlockForm } from './program-block-form';

export type ProgramBlocksProps = {
  /** Name of the workout, for accessible labels. */
  workoutName: string;
  /** Raw issue path of the workout, e.g. `workouts[0]`. */
  path: string;
  blocks: readonly ProgramLink[];
  /** Localized issue messages by raw issue path. */
  errors: Record<string, string>;
  /** An id for a block added now (unique among the plan's blocks and exercises). */
  newBlockId: string;
  findProgram: (id: string) => ProgramTemplate | undefined;
  onAdd: (block: ProgramLink) => void;
  onChange: (index: number, block: ProgramLink) => void;
  onMove: (index: number, delta: -1 | 1) => void;
  onRemove: (index: number) => void;
};

type Editing = number | 'new' | null;

/**
 * The program blocks of a workout, listed above its exercises: a summary line each
 * ("Smolov Jr. · day 1 → Bench Press"), edit / reorder / remove, and "Add program block".
 * A block with an issue opens its form by itself.
 */
export function ProgramBlocks({
  workoutName,
  path,
  blocks,
  errors,
  newBlockId,
  findProgram,
  onAdd,
  onChange,
  onMove,
  onRemove,
}: ProgramBlocksProps) {
  const { t } = useI18n();
  const { exerciseLabel } = useEditorContext();
  const [editing, setEditing] = useState<Editing>(null);

  const blockPath = (index: number) => `${path}.programs[${index}]`;
  const issuesOf = (index: number) =>
    Object.entries(errors)
      .filter(([key]) => key === blockPath(index) || key.startsWith(`${blockPath(index)}.`))
      .map(([, message]) => message);
  // A block that gets an issue opens its form (adjusting state while rendering, as React
  // recommends for state derived from props).
  const firstIssue = blocks.findIndex((_, i) => issuesOf(i).length > 0);
  const [sawIssue, setSawIssue] = useState(firstIssue);
  if (firstIssue !== sawIssue) {
    setSawIssue(firstIssue);
    if (firstIssue >= 0) setEditing(firstIssue);
  }

  const summaryOf = (block: ProgramLink) => {
    const program = findProgram(block.programId);
    const exercises = Object.values(block.roles).map(exerciseLabel).join(', ');
    const params = { program: program?.name ?? t('planEditor.block.unknownProgram'), day: block.day, exercises };
    return exercises ? t('planEditor.block.summary', params) : t('planEditor.block.summaryNoExercise', params);
  };
  const detailOf = (block: ProgramLink) =>
    [
      block.startWeek > 1 ? t('planEditor.block.startsAt', { week: block.startWeek }) : null,
      block.accessories ? t('planEditor.block.withAccessories') : null,
    ]
      .filter((part) => part !== null)
      .join(' · ');

  const workoutError = errors[`${path}.programs`];

  return (
    <View style={styles.container} testID="program-blocks">
      {blocks.map((block, index) => {
        const summary = summaryOf(block);
        const detail = detailOf(block);
        const issues = issuesOf(index);
        if (editing === index) {
          return (
            <View key={block.id} style={styles.container}>
              {issues.map((message) => (
                <Text key={message} variant="caption" tone="danger" accessibilityLiveRegion="polite">
                  {message}
                </Text>
              ))}
              <ProgramBlockForm
                block={block}
                newId={block.id}
                findProgram={findProgram}
                onSave={(next) => {
                  setEditing(null);
                  onChange(index, next);
                }}
                onCancel={() => setEditing(null)}
              />
            </View>
          );
        }
        return (
          <Card key={block.id} testID={`program-block-${block.id}`}>
            <View style={styles.header}>
              <View style={styles.title}>
                <Text variant="label">{summary}</Text>
                {detail ? (
                  <Text tone="secondary" variant="caption">
                    {detail}
                  </Text>
                ) : null}
              </View>
              <Button
                variant="secondary"
                label={t('planEditor.block.edit')}
                accessibilityLabel={t('planEditor.block.editOf', { summary })}
                onPress={() => setEditing(index)}
              />
              <IconButton
                glyph="↑"
                label={t('planEditor.block.moveUpOf', { summary })}
                disabled={index === 0}
                onPress={() => {
                  setEditing(null);
                  onMove(index, -1);
                }}
              />
              <IconButton
                glyph="↓"
                label={t('planEditor.block.moveDownOf', { summary })}
                disabled={index === blocks.length - 1}
                onPress={() => {
                  setEditing(null);
                  onMove(index, 1);
                }}
              />
              <IconButton
                glyph="✕"
                label={t('planEditor.block.removeOf', { summary })}
                onPress={() => {
                  setEditing(null);
                  onRemove(index);
                }}
              />
            </View>
            {issues.map((message) => (
              <Text key={message} variant="caption" tone="danger" accessibilityLiveRegion="polite">
                {message}
              </Text>
            ))}
          </Card>
        );
      })}

      {workoutError ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {workoutError}
        </Text>
      ) : null}

      {editing === 'new' ? (
        <ProgramBlockForm
          block={null}
          newId={newBlockId}
          findProgram={findProgram}
          onSave={(next) => {
            setEditing(null);
            onAdd(next);
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <Button
          variant="secondary"
          label={t('planEditor.block.add')}
          accessibilityLabel={t('planEditor.block.addTo', { workout: workoutName })}
          disabled={blocks.length >= PLAN_LIMITS.programsPerWorkout.max}
          onPress={() => setEditing('new')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, minWidth: 160, gap: spacing.xs },
});
