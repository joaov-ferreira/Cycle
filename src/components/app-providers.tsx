import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { palettes, spacing, type ColorScheme } from '@/constants/theme';
import type { Repositories } from '@/data/repositories';
import {
  catalogs,
  effectiveLocale,
  getDeviceLocaleTag,
  I18nProvider,
  resolveLocale,
  translate,
  useDeviceLocaleTag,
  useT,
} from '@/i18n';
import { createAppStore, selectColorScheme, selectLanguageSetting, type AppStore } from '@/state/app-store';
import { AppStoreProvider, useAppStore } from '@/state/app-store-context';

import { ThemeProvider, useTheme } from './theme-provider';
import { Text } from './ui/Text';

type Boot = { kind: 'loading' } | { kind: 'ready'; store: AppStore } | { kind: 'error' };

export type AppProvidersProps = {
  /** Opens persistence (SQLite in the app, in-memory in tests). Must be a stable reference. */
  openRepositories: () => Promise<Repositories>;
  /** Called once boot finishes (successfully or not), e.g. to hide the splash screen. */
  onReady?: () => void;
  children: ReactNode;
};

function navigationTheme(scheme: ColorScheme) {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const p = palettes[scheme];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: p.accent,
      background: p.background,
      card: p.surface,
      text: p.text,
      border: p.border,
      notification: p.accent,
    },
  };
}

/** Locale + theme for the booted app, both derived from the persisted settings. */
function SettingsDrivenProviders({ children }: { children: ReactNode }) {
  const deviceTag = useDeviceLocaleTag();
  const language = useAppStore(selectLanguageSetting);
  const scheme = useAppStore(selectColorScheme);
  const navTheme = useMemo(() => navigationTheme(scheme), [scheme]);
  return (
    <I18nProvider locale={effectiveLocale(language, deviceTag)}>
      <ThemeProvider scheme={scheme}>
        <NavigationThemeProvider value={navTheme}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          {children}
        </NavigationThemeProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

function BootScreen({ failed }: { failed: boolean }) {
  const t = useT();
  const { colors } = useTheme();
  return (
    <View style={[styles.boot, { backgroundColor: colors.background }]}>
      {failed ? (
        <Text tone="danger" accessibilityRole="alert">
          {t('app.startupError')}
        </Text>
      ) : (
        <>
          <ActivityIndicator color={colors.accent} />
          <Text tone="secondary">{t('app.loading')}</Text>
        </>
      )}
    </View>
  );
}

/**
 * Root providers: opens persistence, boots the app store (default profile on first boot),
 * then provides store, locale (setting or device) and theme (dark by default).
 */
export function AppProviders({ openRepositories, onReady, children }: AppProvidersProps) {
  const deviceTag = useDeviceLocaleTag();
  const [boot, setBoot] = useState<Boot>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: Boot;
      try {
        const store = createAppStore(await openRepositories());
        const locale = resolveLocale(getDeviceLocaleTag());
        await store.getState().init(translate(catalogs[locale], locale, 'profile.defaultName'));
        next = store.getState().status === 'ready' ? { kind: 'ready', store } : { kind: 'error' };
      } catch {
        next = { kind: 'error' };
      }
      if (!cancelled) {
        setBoot(next);
        onReady?.();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openRepositories, onReady]);

  if (boot.kind !== 'ready') {
    return (
      <I18nProvider locale={resolveLocale(deviceTag)}>
        <ThemeProvider scheme="dark">
          <BootScreen failed={boot.kind === 'error'} />
        </ThemeProvider>
      </I18nProvider>
    );
  }
  return (
    <AppStoreProvider store={boot.store}>
      <SettingsDrivenProviders>{children}</SettingsDrivenProviders>
    </AppStoreProvider>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
});
