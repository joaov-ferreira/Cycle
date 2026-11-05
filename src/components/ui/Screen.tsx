import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, spacing } from '@/constants/theme';

import { useTheme } from '../theme-provider';
import { Text } from './Text';

export type ScreenProps = {
  title?: string;
  children: ReactNode;
  testID?: string;
};

/** Screen container: theme background, safe area, scrolling and a centered max width. */
export function Screen({ title, children, testID }: ScreenProps) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.root, { backgroundColor: colors.background }]}
      testID={testID}>
      <ScrollView contentContainerStyle={styles.content}>
        {title ? <Text variant="title">{title}</Text> : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
});
