import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import type { Lift } from '@/domain/lifts';
import type { GeneratedMainItem, GeneratedSession, GeneratedSet, OtherLiftItem } from '@/domain/periodization';
import { useI18n } from '@/i18n';
import { pickLocalized } from '@/programs/localized';
import type { InfoItem, LocalizedText, SetPrescription } from '@/programs/schema';

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

/** `Squat — Front squat`, `Squat`, or just `Front squat` when the lift is implied by the context. */
export function useExerciseLabel(): (lift: Lift, exercise: LocalizedText | undefined, showLift: boolean) => string | null {
  const { t, locale } = useI18n();
  return (lift, exercise, showLift) => {
    if (!exercise) return showLift ? t(`lifts.${lift}`) : null;
    const name = pickLocalized(exercise, locale);
    return showLift ? t('programs.detail.liftExercise', { lift: t(`lifts.${lift}`), exercise: name }) : name;
  };
}

/** `2 × 6 @ 50%` for a set as the original prescribes it (no load; used for other lifts of the day). */
function usePrescribedSetLine(): (set: SetPrescription) => string {
  const { t, formatKg, formatPercent } = useI18n();
  return (set) => {
    const params = {
      sets: set.repeat ?? 1,
      reps: set.reps,
      percent: set.percent === undefined ? t('periodization.table.noLoad') : formatPercent(set.percent),
    };
    const line = !set.addKg
      ? t('periodization.table.set', params)
      : t('periodization.table.setWithAdd', {
          ...params,
          add: 'kg' in set.addKg ? formatKg(set.addKg.kg) : t('periodization.table.noLoad'),
        });
    return set.amrap ? `${line} — ${t('periodization.table.amrap')}` : line;
  };
}

export function MainItemView({ item, sessionLift }: { item: GeneratedMainItem; sessionLift: GeneratedSession['lift'] }) {
  const { locale } = useI18n();
  const label = useExerciseLabel()(item.lift, item.exercise, item.lift !== sessionLift);
  return (
    <View style={styles.set}>
      {label ? <Text variant="label">{label}</Text> : null}
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

/** An informational line (rest day, max test, loosely described phase): text, badge and note. */
export function InfoItemView({ item }: { item: InfoItem }) {
  const { t, locale } = useI18n();
  return (
    <View style={styles.set}>
      {item.lift ? <Text variant="label">{t(`lifts.${item.lift}`)}</Text> : null}
      <Text>{pickLocalized(item.text, locale)}</Text>
      {item.unverified ? (
        <Text variant="caption" tone="danger">
          {t('programs.unverifiedSet')}
        </Text>
      ) : null}
      {item.note ? (
        <Text variant="caption" tone="secondary">
          {pickLocalized(item.note, locale)}
        </Text>
      ) : null}
    </View>
  );
}

/** The day's lines for other lifts (multi-lift days): the original prescription, without loads. */
export function OtherLiftItems({ items }: { items: readonly OtherLiftItem[] }) {
  const { t, locale } = useI18n();
  const exerciseLabel = useExerciseLabel();
  const setLine = usePrescribedSetLine();
  if (items.length === 0) return null;
  return (
    <View testID="other-lifts" style={styles.set}>
      <Text variant="caption" tone="secondary">
        {t('periodization.table.otherLifts')}
      </Text>
      {items.map((item, index) =>
        item.kind === 'info' ? (
          <InfoItemView key={index} item={item} />
        ) : (
          <View key={index} style={styles.set}>
            <Text variant="label" tone="secondary">
              {exerciseLabel(item.lift, item.exercise, true)}
            </Text>
            {item.sets.map((set, setIndex) => (
              <Text key={setIndex} tabular tone="secondary">
                {setLine(set)}
              </Text>
            ))}
            {item.note ? (
              <Text variant="caption" tone="secondary">
                {pickLocalized(item.note, locale)}
              </Text>
            ) : null}
          </View>
        ),
      )}
    </View>
  );
}

/**
 * Main lifts (sets with exact → rounded loads), accessory and informational lines of a session,
 * then the day's other lifts as information.
 */
export function SessionItems({ session }: { session: GeneratedSession }) {
  const { t, locale } = useI18n();
  return (
    <>
      {session.items.map((item, index) =>
        item.kind === 'main' ? (
          <MainItemView key={index} item={item} sessionLift={session.lift} />
        ) : item.kind === 'info' ? (
          <InfoItemView key={index} item={item} />
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
      <OtherLiftItems items={session.otherItems} />
    </>
  );
}

const styles = StyleSheet.create({
  set: { gap: spacing.xs / 2 },
});
