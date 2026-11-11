import { usePathname, useRouter, type Href } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, radius, spacing } from '@/constants/theme';
import { useT, type MessageKey } from '@/i18n';

import { useTheme } from '../theme-provider';
import { Text } from '../ui/Text';

type SectionId = 'home' | 'plan' | 'workout' | 'progress' | 'exercises' | 'history' | 'body' | 'settings';

type Section = {
  id: SectionId;
  label: MessageKey;
  icon: SymbolViewProps['name'];
  href: Href;
};

/** SPEC §12 wide-screen sidebar, in order. */
const SECTIONS: readonly Section[] = [
  { id: 'home', label: 'tabs.home', icon: { ios: 'house', android: 'home', web: 'home' }, href: '/' },
  { id: 'plan', label: 'tabs.plan', icon: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }, href: '/plan' },
  { id: 'workout', label: 'tabs.workout', icon: { ios: 'dumbbell', android: 'fitness_center', web: 'fitness_center' }, href: '/workout' },
  { id: 'progress', label: 'tabs.progress', icon: { ios: 'chart.line.uptrend.xyaxis', android: 'trending_up', web: 'trending_up' }, href: '/progress' },
  { id: 'exercises', label: 'exercises.title', icon: { ios: 'figure.strengthtraining.traditional', android: 'sports_gymnastics', web: 'sports_gymnastics' }, href: '/exercises' },
  { id: 'history', label: 'history.title', icon: { ios: 'clock.arrow.circlepath', android: 'history', web: 'history' }, href: '/history' },
  { id: 'body', label: 'body.title', icon: { ios: 'scalemass', android: 'monitor_weight', web: 'monitor_weight' }, href: '/body' },
  { id: 'settings', label: 'settings.title', icon: { ios: 'gearshape', android: 'settings', web: 'settings' }, href: '/settings' },
];

/** First path segment → section, for the routes that belong to a section but have another name. */
const SEGMENT_SECTIONS: Record<string, SectionId> = {
  plan: 'plan',
  plans: 'plan',
  workout: 'workout',
  progress: 'progress',
  exercises: 'exercises',
  history: 'history',
  body: 'body',
  settings: 'settings',
};

/** The section a location belongs to (null for routes without an entry, e.g. More). */
export function activeSection(pathname: string): SectionId | null {
  if (pathname === '/') return 'home';
  const [first] = pathname.split('/').filter(Boolean);
  return SEGMENT_SECTIONS[first] ?? null;
}

/**
 * Wide-screen (≥ 900 px) navigation: a labeled sidebar with every section (SPEC §12) instead of
 * the bottom tab bar. Rendered by `AppShell`, so it stays on screen on the stack routes too.
 */
export function Sidebar() {
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const current = activeSection(pathname);
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
        {SECTIONS.map((section) => {
          const label = t(section.label);
          const focused = current === section.id;
          const color = focused ? colors.text : colors.textSecondary;
          return (
            <Pressable
              key={section.id}
              testID={`sidebar-item-${section.id}`}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: focused }}
              onPress={() => {
                if (!focused) router.navigate(section.href);
              }}
              style={[styles.item, focused && { backgroundColor: colors.surfaceRaised }]}>
              <SymbolView name={section.icon} tintColor={color} size={22} />
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
