import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, radius, spacing } from '@/constants/theme';
import { useT } from '@/i18n';

import { useTheme } from '../theme-provider';
import { Text } from '../ui/Text';

/** Wide-screen (≥ 900 px) navigation: a labeled sidebar instead of the bottom tab bar. */
export function Sidebar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left']}
      testID="navigation-sidebar"
      accessibilityLabel={t('navigation.label')}
      style={[styles.sidebar, { backgroundColor: colors.surface, borderRightColor: colors.border }]}>
      <Text variant="heading" style={styles.brand}>
        {t('app.name')}
      </Text>
      <View style={styles.items}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const focused = state.index === index;
          const color = focused ? colors.text : colors.textSecondary;
          const onPress = () => {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: focused }}
              onPress={onPress}
              style={[styles.item, focused && { backgroundColor: colors.surfaceRaised }]}>
              {options.tabBarIcon?.({ focused, color, size: 22 })}
              <Text variant="label" style={{ color }}>
                {label}
              </Text>
              {focused ? <View style={[styles.marker, { backgroundColor: colors.accent }]} /> : null}
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: layout.sidebarWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.xl,
  },
  brand: { paddingHorizontal: spacing.md, letterSpacing: 2 },
  items: { gap: spacing.xs },
  item: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  marker: { marginLeft: 'auto', width: 4, height: 20, borderRadius: 2 },
});
