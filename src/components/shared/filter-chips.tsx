import { ScrollView, StyleSheet } from 'react-native';

import { spacing } from '@/constants/theme';

import { Chip } from './chip';

export type FilterOption<T extends string> = { value: T; label: string };

export type FilterChipsProps<T extends string> = {
  options: readonly FilterOption<T>[];
  /** The selected option, or `null` for no filter ("all"). */
  value: T | null;
  /**
   * Called with the new filter. Pressing "all" clears the filter; pressing the selected option
   * again clears it too.
   */
  onChange: (value: T | null) => void;
  /** Label of the leading "all" chip. */
  allLabel: string;
  testID?: string;
};

/** A horizontal row of mutually exclusive filter chips, "all" first. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  allLabel,
  testID,
}: FilterChipsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.row}
      testID={testID}>
      <Chip
        label={allLabel}
        selected={value === null}
        onPress={() => {
          if (value !== null) onChange(null);
        }}
      />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Chip
            key={option.value}
            label={option.label}
            selected={selected}
            onPress={() => onChange(selected ? null : option.value)}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
});
