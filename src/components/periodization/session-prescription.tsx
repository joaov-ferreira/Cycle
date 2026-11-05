import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import type { GeneratedMainItem, GeneratedSession, GeneratedSet } from '@/domain/periodization';
import { useI18n } from '@/i18n';
import { pickLocalized } from '@/programs/localized';

import { Text } from '../ui';

/** `Program week 2 · Phase · Day 3 — Label`: where a session sits in its program. */
export function useSessionContext(): (session: GeneratedSession) => string {
  const { t, locale } = useI18n();
  return (session) => {
    const parts = [t('periodization.table.programWeek', { week: session.programWeek })];
    if (session.phase) parts.push(pickLocalized(session.phase, locale));
    if (session.daysPerWeek > 1 || session.dayLabel) {
      const day = t('periodization.table.day', { day: session.programDay });
      parts.push(session.dayLabel ? `${day} — ${pickLocalized(session.dayLabel, locale)}` : day);
    }
    return parts.join(' · ');
  };
}

/** `3 × 5 @ 75% [+ 5.0 kg]` plus the AMRAP note: the prescription of a set without its load. */
export function useSetLine(): (set: GeneratedSet) => string {
  const { t, formatKg, formatPercent } = useI18n();
  return (set) => {
    const params = {
      sets: set.sets,
      reps: set.reps,
      percent: set.percent === null ? t('periodization.table.noLoad') : formatPercent(set.percent),
    };
    const line =
      set.addKg === null
        ? t('periodization.table.set', params)
        : t('periodization.table.setWithAdd', { ...params, add: formatKg(set.addKg) });
    return set.amrap ? `${line} — ${t('periodization.table.amrap')}` : line;
  };
}

export function SetLines({ set }: { set: GeneratedSet }) {
  const { t, locale, formatKg } = useI18n();
  const setLine = useSetLine();
  return (
    <View style={styles.set}>
      <Text tabular>{setLine(set)}</Text>
      {set.exactKg !== null && set.roundedKg !== null ? (
        <Text tabular variant="label">
          {t('periodization.table.load', { exact: formatKg(set.exactKg), rounded: formatKg(set.roundedKg) })}
        </Text>
      ) : (
        <>
          <Text variant="label">{t('periodization.table.noLoad')}</Text>
          <Text variant="caption" tone="danger">
            {set.load === 'missingOneRm' ? t('periodization.table.missingOneRm') : t('periodization.table.unverified')}
          </Text>
        </>
      )}
      {set.note ? (
        <Text variant="caption" tone="secondary">
          {pickLocalized(set.note, locale)}
        </Text>
      ) : null}
    </View>
  );
}

export function MainItemView({ item, sessionLift }: { item: GeneratedMainItem; sessionLift: GeneratedSession['lift'] }) {
  const { t, locale } = useI18n();
  return (
    <View style={styles.set}>
      {item.lift !== sessionLift ? <Text variant="label">{t(`lifts.${item.lift}`)}</Text> : null}
      {item.sets.map((set, index) => (
        <SetLines key={index} set={set} />
      ))}
      {item.note ? (
        <Text variant="caption" tone="secondary">
          {pickLocalized(item.note, locale)}
        </Text>
      ) : null}
    </View>
  );
}

/** Main lifts (sets with exact → rounded loads) and accessory lines of a session. */
export function SessionItems({ session }: { session: GeneratedSession }) {
  const { t, locale } = useI18n();
  return (
    <>
      {session.items.map((item, index) =>
        item.kind === 'main' ? (
          <MainItemView key={index} item={item} sessionLift={session.lift} />
        ) : (
          <View key={index} style={styles.set}>
            <Text>
              {t('programs.detail.accessory', {
                name: pickLocalized(item.name, locale),
                text: pickLocalized(item.text, locale),
              })}
            </Text>
            {item.note ? (
              <Text variant="caption" tone="secondary">
                {pickLocalized(item.note, locale)}
              </Text>
            ) : null}
          </View>
        ),
      )}
    </>
  );
}

const styles = StyleSheet.create({
  set: { gap: spacing.xs / 2 },
});
