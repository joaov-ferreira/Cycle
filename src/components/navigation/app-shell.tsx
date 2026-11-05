import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { navigationLayoutFor } from './app-tabs';
import { Sidebar } from './sidebar';

/**
 * Wraps every route: on wide screens (SPEC §11, ≥ 900 px) the sidebar sits beside the content, so
 * it stays visible on the stack routes too (Programs, History, Settings, session detail); on
 * phones the content is shown as is and the tabs navigate.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  if (navigationLayoutFor(width) !== 'sidebar') return <>{children}</>;
  return (
    <View style={styles.row}>
      <Sidebar />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  content: { flex: 1 },
});
