import { useGlobalSearchParams, usePathname, useRouter, type Href } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, radius, spacing } from '@/constants/theme';
import { useT, type MessageKey } from '@/i18n';

import { useTheme } from '../theme-provider';
import { Text } from '../ui/Text';

type SectionId =
  | 'dashboard'
  | 'periodization'
  | 'programs'
  | 'calendar'
  | 'training'
  | 'progress'
  | 'history'
  | 'settings';

type Section = {
  id: SectionId;
  label: MessageKey;
  icon: SymbolViewProps['name'];
  href: Href;
};

/** SPEC §11 web/desktop sidebar, in order. */
const SECTIONS: readonly Section[] = [
  { id: 'dashboard', label: 'tabs.dashboard', icon: { ios: 'square.grid.2x2', android: 'dashboard', web: 'dashboard' }, href: '/' },
  { id: 'periodization', label: 'tabs.periodization', icon: { ios: 'tablecells', android: 'table_chart', web: 'table_chart' }, href: { pathname: '/periodization', params: { view: 'table' } } },
  { id: 'programs', label: 'screens.more.programs', icon: { ios: 'books.vertical', android: 'menu_book', web: 'menu_book' }, href: '/programs' },
  { id: 'calendar', label: 'periodization.view.calendar', icon: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }, href: { pathname: '/periodization', params: { view: 'calendar' } } },
  { id: 'training', label: 'tabs.training', icon: { ios: 'dumbbell', android: 'fitness_center', web: 'fitness_center' }, href: '/training' },
  { id: 'progress', label: 'tabs.progress', icon: { ios: 'chart.line.uptrend.xyaxis', android: 'trending_up', web: 'trending_up' }, href: '/progress' },
  { id: 'history', label: 'screens.more.history', icon: { ios: 'clock.arrow.circlepath', android: 'history', web: 'history' }, href: '/history' },
  { id: 'settings', label: 'screens.more.settings', icon: { ios: 'gearshape', android: 'settings', web: 'settings' }, href: '/settings' },
];

/** The section a location belongs to (null for routes without an entry, e.g. More or a session). */
export function activeSection(pathname: string, view: string | undefined): SectionId | null {
  if (pathname === '/') return 'dashboard';
  if (pathname === '/periodization') return view === 'calendar' ? 'calendar' : 'periodization';
  const [first] = pathname.split('/').filter(Boolean);
  return SECTIONS.some((section) => section.id === first) ? (first as SectionId) : null;
}

/**
 * Wide-screen (≥ 900 px) navigation: a labeled sidebar with every section (SPEC §11) instead of
 * the bottom tab bar. Rendered by `AppShell`, so it stays on screen on the stack routes too.
 */
export function Sidebar() {
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const { view } = useGlobalSearchParams<{ view?: string }>();
  const current = activeSection(pathname, view);
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
