import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';
import type {
  ProgramDay,
  ProgramItem,
  ProgramSet,
  ProgramTemplate,
  ProgramText,
  ProgramWeek,
} from '@/domain/program';
import { useI18n } from '@/i18n';

import { useTheme } from '../theme-provider';
import { Text } from '../ui';
import { useProgramText, useSetLabel, type SetAddition } from './set-label';

/** Fraction of the 1RM → percentage points, through integers (0.825 → 82.5). */
export function toPercentPoints(fraction: number): number {
  return Math.round(fraction * 10_000) / 100;
}

function UnverifiedBadge() {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { borderColor: colors.danger }]}>
      <Text variant="caption" tone="danger">
        {t('programs.detail.unverified')}
      </Text>
    </View>
  );
}

function MainItem({
  template,
  item,
}: {
  template: ProgramTemplate;
  item: Extract<ProgramItem, { kind: 'main' }>;
}) {
  const text = useProgramText();
  const setLabel = useSetLabel();
  const params = new Map((template.configurable ?? []).map((param) => [param.id, param]));
  const title = item.variation?.name ?? template.roles.find((role) => role.id === item.role)?.label;

  const groupLabel = (set: ProgramSet): string => {
    let add: SetAddition | undefined;
    if (set.addKg && 'kg' in set.addKg) add = { kind: 'kg', kg: set.addKg.kg };
    else if (set.addKg) {
      const param = params.get(set.addKg.param);
      add = { kind: 'param', label: param ? text(param.label) : set.addKg.param, times: set.addKg.times ?? 1 };
    }
    return setLabel({
      sets: set.repeat ?? 1,
      reps: set.reps,
      ...(set.percent !== undefined ? { percent: toPercentPoints(set.percent) } : {}),
      ...(set.amrap ? { amrap: true } : {}),
      ...(add ? { add } : {}),
    });
  };

  const notes: ProgramText[] = [];
  for (const set of item.sets) {
    if (set.note && !notes.some((known) => known.en === set.note?.en)) notes.push(set.note);
  }
  const unverified = item.sets.some((set) => set.unverified);

  return (
    <View style={styles.item}>
      {title ? <Text variant="label">{text(title)}</Text> : null}
      <Text tabular>{item.sets.map(groupLabel).join(', ')}</Text>
      {unverified ? <UnverifiedBadge /> : null}
      {notes.map((note) => (
        <Text key={note.en} variant="caption" tone="secondary">
          {text(note)}
        </Text>
      ))}
      {item.note ? (
        <Text variant="caption" tone="secondary">
          {text(item.note)}
        </Text>
      ) : null}
    </View>
  );
}

function Item({ template, item }: { template: ProgramTemplate; item: ProgramItem }) {
  const { t, formatNumber } = useI18n();
  const text = useProgramText();
  if (item.kind === 'main') return <MainItem template={template} item={item} />;
  if (item.kind === 'accessory') {
    return (
      <View style={styles.item}>
        <Text>
          {t('programs.accessory', {
            name: text(item.name),
            sets: formatNumber(item.sets),
            reps: formatNumber(item.reps),
          })}
        </Text>
        {item.note ? (
          <Text variant="caption" tone="secondary">
            {text(item.note)}
          </Text>
        ) : null}
      </View>
    );
  }
  return (
    <View style={styles.item}>
      <Text>{text(item.text)}</Text>
      {item.unverified ? <UnverifiedBadge /> : null}
      {item.note ? (
        <Text variant="caption" tone="secondary">
          {text(item.note)}
        </Text>
      ) : null}
    </View>
  );
}

function Day({ template, day }: { template: ProgramTemplate; day: ProgramDay }) {
  const { t } = useI18n();
  const text = useProgramText();
  return (
    <View style={styles.day}>
      <Text variant="label" tone="accent">
        {day.label
          ? t('programs.detail.dayLabel', { day: day.day, label: text(day.label) })
          : t('programs.detail.day', { day: day.day })}
      </Text>
      {day.items.map((item, index) => (
        <Item key={index} template={template} item={item} />
      ))}
    </View>
  );
}

/** One week of a program: a collapsible section whose header names the week and its phase. */
export function WeekSection({
  template,
  week,
  initiallyOpen,
}: {
  template: ProgramTemplate;
  week: ProgramWeek;
  initiallyOpen: boolean;
}) {
  const { t } = useI18n();
  const text = useProgramText();
  const { colors } = useTheme();
  const [open, setOpen] = useState(initiallyOpen);
  const title = week.phase
    ? t('programs.detail.weekPhase', { week: week.week, phase: text(week.phase) })
    : t('programs.detail.week', { week: week.week });
  return (
    <View style={[styles.week, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={styles.weekHeader}>
        <Text variant="heading" style={styles.weekTitle} accessibilityRole="text">
          {title}
        </Text>
        <Text tone="secondary">{open ? '▾' : '▸'}</Text>
      </Pressable>
      {open ? week.days.map((day) => <Day key={day.day} template={template} day={day} />) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  week: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  weekHeader: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  weekTitle: { flex: 1 },
  day: { gap: spacing.xs, paddingVertical: spacing.sm },
  item: { gap: spacing.xs },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
});
