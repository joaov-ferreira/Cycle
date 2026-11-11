import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import type { Exercise } from '@/domain/exercise';
import { useI18n } from '@/i18n';

import { Chip, exerciseName } from '../shared';
import { Button, Card, Text } from '../ui';

export type UnresolvedItemProps = {
  /** The name as written in the document. */
  name: string;
  suggestions: readonly Exercise[];
  /** Display name of the chosen exercise (existing or to be created), when resolved. */
  chosen: { name: string; creates: boolean } | null;
  onSuggestion: (exercise: Exercise) => void;
  onChooseAnother: () => void;
  onCreateNew: () => void;
  onChange: () => void;
  testID?: string;
};

/** One unresolved name: suggestion chips and the two other ways out, or the chosen resolution. */
export function UnresolvedItem({
  name,
  suggestions,
  chosen,
  onSuggestion,
  onChooseAnother,
  onCreateNew,
  onChange,
  testID,
}: UnresolvedItemProps) {
  const { t, locale } = useI18n();
  if (chosen) {
    return (
      <Card testID={testID}>
        <Text>
          {t(chosen.creates ? 'planImport.preview.resolvedCreate' : 'planImport.preview.resolvedExisting', {
            name,
            target: chosen.name,
          })}
        </Text>
        <View style={styles.actions}>
          <Button
            variant="secondary"
            label={t('planImport.preview.change', { name })}
            onPress={onChange}
          />
        </View>
      </Card>
    );
  }
  return (
    <Card testID={testID}>
      <Text variant="heading">{name}</Text>
      {suggestions.length > 0 ? (
        <>
          <Text variant="label" tone="secondary">
            {t('planImport.preview.suggestions')}
          </Text>
          <View style={styles.actions}>
            {suggestions.map((exercise) => (
              <Chip
                key={exercise.id}
                label={exerciseName(exercise, locale)}
                selected={false}
                onPress={() => onSuggestion(exercise)}
              />
            ))}
          </View>
        </>
      ) : null}
      <View style={styles.actions}>
        <Button variant="secondary" label={t('planImport.preview.chooseAnother')} onPress={onChooseAnother} />
        <Button variant="secondary" label={t('planImport.preview.createNew')} onPress={onCreateNew} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
