import { Tabs } from 'expo-router/js-tabs';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useWindowDimensions } from 'react-native';

import { layout } from '@/constants/theme';
import { useT, type MessageKey } from '@/i18n';

import { useTheme } from '../theme-provider';

export type NavigationLayout = 'tabs' | 'sidebar';

/** SPEC §12: bottom tabs on mobile, sidebar at window widths ≥ 900 px. */
export function navigationLayoutFor(width: number): NavigationLayout {
  return width >= layout.wideBreakpoint ? 'sidebar' : 'tabs';
}

type TabSpec = { name: string; label: MessageKey; icon: SymbolViewProps['name'] };

const TABS: readonly TabSpec[] = [
  { name: 'index', label: 'tabs.home', icon: { ios: 'house', android: 'home', web: 'home' } },
  { name: 'plan', label: 'tabs.plan', icon: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' } },
  { name: 'workout', label: 'tabs.workout', icon: { ios: 'dumbbell', android: 'fitness_center', web: 'fitness_center' } },
  { name: 'progress', label: 'tabs.progress', icon: { ios: 'chart.line.uptrend.xyaxis', android: 'trending_up', web: 'trending_up' } },
  { name: 'more', label: 'tabs.more', icon: { ios: 'ellipsis.circle', android: 'more_horiz', web: 'more_horiz' } },
];

/** Main navigator: 5 localized tabs (Home, Plan, Workout, Progress, More). */
export function AppTabs() {
  const t = useT();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const wide = navigationLayoutFor(width) === 'sidebar';

  return (
    <Tabs
      // On wide screens the sidebar (AppShell, root layout) replaces the tab bar.
      tabBar={wide ? () => null : undefined}
      screenOptions={{
        headerShown: false,
        tabBarPosition: 'bottom',
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarActiveBackgroundColor: colors.surfaceRaised,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      {TABS.map((tab) => {
        const title = t(tab.label);
        return (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title,
              tabBarAccessibilityLabel: title,
              tabBarIcon: ({ color, size }) => (
                <SymbolView name={tab.icon} tintColor={color} size={size} />
              ),
            }}
          />
        );
      })}
    </Tabs>
  );
}
