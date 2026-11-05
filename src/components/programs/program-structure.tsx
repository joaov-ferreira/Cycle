import { View } from 'react-native';

import { spacing } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { pickLocalized } from '@/programs/localized';
import { addKgValue, type ParamValues } from '@/programs/params';
import type { MainItem, ProgramTemplate, SetPrescription } from '@/programs/schema';

import { InfoItemView } from '../periodization/session-prescription';
import { Card, Text } from '../ui';

const NO_PERCENT = '—';

function SetLine({ set, values }: { set: SetPrescription; values: ParamValues }) {
  const { t, locale, formatPercent, formatKg } = useI18n();
  const params = {
    sets: set.repeat ?? 1,
    reps: set.reps,
    percent: set.percent === undefined ? NO_PERCENT : formatPercent(set.percent),
  };
  const added = set.addKg ? addKgValue(set.addKg, values) : null;
  const base = set.addKg
    ? t('programs.setWithAdd', { ...params, add: added === null ? NO_PERCENT : formatKg(added) })
    : t('programs.set', params);
  return (
    <View style={{ gap: spacing.xs }}>
      <Text tabular>{set.amrap ? `${base} — ${t('programs.amrap')}` : base}</Text>
      {set.unverified ? <Text tone="danger" variant="caption">{t('programs.unverifiedSet')}</Text> : null}
      {set.note ? (
        <Text tone="secondary" variant="caption">
          {pickLocalized(set.note, locale)}
        </Text>
      ) : null}
    </View>
  );
}

function MainBlock({ item, values }: { item: MainItem; values: ParamValues }) {
  const { t, locale } = useI18n();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label">{item.lift === 'selected' ? t('programs.detail.selectedLift') : t(`lifts.${item.lift}`)}</Text>
      {item.sets.map((set, index) => (
        <SetLine key={index} set={set} values={values} />
      ))}
      {item.note ? <Text tone="secondary">{pickLocalized(item.note, locale)}</Text> : null}
    </View>
  );
}

/**
 * The original structure of a template, week by week (SPEC §3.5): sets, reps and percentages,
 * accessories and informational lines as text. No loads are calculated. Percent-linked sets must already carry the
 * values to show (see `resolveTemplate`); absolute increments (`addKg`) are read from `values`.
 */
export function ProgramStructure({ template, values = {} }: { template: ProgramTemplate; values?: ParamValues }) {
  const { t, locale } = useI18n();
  return (
    <View style={{ gap: spacing.lg }}>
      {template.weeks.map((week) => {
        const phase = week.phase ? ` — ${pickLocalized(week.phase, locale)}` : '';
        return (
          <Card key={week.week} testID={`week-${week.week}`}>
            <Text variant="heading">{`${t('programs.detail.week', { week: week.week })}${phase}`}</Text>
            {week.days.map((day) => {
              const label = day.label ? ` — ${pickLocalized(day.label, locale)}` : '';
              return (
                <View key={day.day} style={{ gap: spacing.sm }}>
                  <Text variant="heading">{`${t('programs.detail.day', { day: day.day })}${label}`}</Text>
                  {day.items.map((item, index) =>
                    item.kind === 'main' ? (
                      <MainBlock key={index} item={item} values={values} />
                    ) : item.kind === 'info' ? (
                      <InfoItemView key={index} item={item} />
                    ) : (
                      <View key={index} style={{ gap: spacing.xs }}>
                        <Text>
                          {t('programs.detail.accessory', {
                            name: pickLocalized(item.name, locale),
                            text: pickLocalized(item.text, locale),
                          })}
                        </Text>
                        {item.note ? (
                          <Text tone="secondary" variant="caption">
                            {pickLocalized(item.note, locale)}
                          </Text>
                        ) : null}
                      </View>
                    ),
                  )}
                </View>
              );
            })}
          </Card>
        );
      })}
    </View>
  );
}
