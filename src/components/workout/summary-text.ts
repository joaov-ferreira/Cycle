import type { NewRecord } from '@/domain/stats';
import type { LoggedSet, Workout, WorkoutSummary } from '@/domain/workout';
import type { I18nValue } from '@/i18n';

type Formatters = Pick<I18nValue, 't' | 'formatKg' | 'formatNumber' | 'formatDate'>;

export type SummaryTextInput = {
  workout: Workout;
  summary: WorkoutSummary;
  records: readonly NewRecord[];
  /** Display name of an exercise in the UI language. */
  nameOf: (exerciseId: string) => string;
};

/** Consecutive sets with the same weight, e.g. `{ weightKg: 40, reps: [12, 12, 12] }`. */
function groupByWeight(sets: readonly LoggedSet[]): { weightKg: number; reps: number[] }[] {
  const groups: { weightKg: number; reps: number[] }[] = [];
  for (const set of sets) {
    if (set.weightKg === null || set.reps === null) continue;
    const last = groups[groups.length - 1];
    if (last && last.weightKg === set.weightKg) last.reps.push(set.reps);
    else groups.push({ weightKg: set.weightKg, reps: [set.reps] });
  }
  return groups;
}

/**
 * The workout summary as plain text for the share sheet (SPEC-v3 §11): name, date, one line per
 * exercise (`Bench Press: 40 kg × 12, 12, 12 · drop 32.5 kg × 8`), total volume and the records.
 */
export function summaryText(
  { t, formatKg, formatNumber, formatDate }: Formatters,
  { workout, summary, records, nameOf }: SummaryTextInput,
): string {
  const kg = (value: number) => formatKg(value, { minimumFractionDigits: 0 });
  const repsList = (reps: number[]) => reps.map((r) => formatNumber(r)).join(', ');
  const lines = [workout.name, formatDate(new Date(workout.completedAt ?? workout.startedAt))];

  for (const exercise of workout.exercises) {
    const done = exercise.sets.filter((set) => set.done);
    const working = groupByWeight(done.filter((set) => set.kind === 'working')).map(({ weightKg, reps }) =>
      t('workout.shareWeightReps', {
        weight: kg(weightKg),
        reps: repsList(reps),
      }),
    );
    const drops = groupByWeight(done.filter((set) => set.kind === 'drop')).map(({ weightKg, reps }) =>
      t('workout.shareDrop', { weight: kg(weightKg), reps: repsList(reps) }),
    );
    const parts = [...working, ...drops];
    if (parts.length > 0) lines.push(`${nameOf(exercise.exerciseId)}: ${parts.join(' · ')}`);
  }

  lines.push(t('workout.shareVolume', { volume: kg(summary.volumeKg) }));

  if (records.length > 0) {
    lines.push(`${t('workout.records')}:`);
    for (const record of records) {
      const kind = t(record.kind === 'weight' ? 'workout.recordWeight' : 'workout.recordE1rm');
      const value = t('workout.recordValue', {
        value: kg(record.valueKg),
        previous: kg(record.previousKg),
      });
      lines.push(`${nameOf(record.exerciseId)}: ${kind} ${value}`);
    }
  }
  return lines.join('\n');
}

/** `+6 kg` / `−675 kg` / `+5.9%`: a signed change; `text` is the formatted magnitude. */
export function signedChange(t: Formatters['t'], value: number, text: string): string {
  return t(value < 0 ? 'workout.deltaMinus' : 'workout.deltaPlus', { value: text });
}
