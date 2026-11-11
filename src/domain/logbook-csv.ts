/**
 * Logbook CSV export (SPEC-v3 §8.2, SPEC-v4 §11.2). Pure: RFC 4180, `.` decimals, CRLF line ends.
 * The last three columns hold the prescription of the set (empty without one): a working set is
 * paired with the prescribed set of the same order among the working sets of its exercise.
 */
import type { Workout } from './workout';

const HEADER = 'date,workout,plan,phase,exercise_id,exercise,set,kind,weight_kg,reps,rir,prescribed_weight_kg,prescribed_reps,percent';

function field(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Plain decimal, no exponent, no trailing zeros; empty for null. */
function formatNumber(value: number | null): string {
  return value === null ? '' : String(Number(value.toFixed(6)));
}

export function logbookCsv(
  workouts: readonly Workout[],
  lookup: { exerciseName(id: string): string; planName(id: number): string | null },
): string {
  const completed = workouts
    .filter((w): w is Workout & { completedAt: string } => w.status === 'completed' && w.completedAt !== null)
    .sort((a, b) => (a.completedAt < b.completedAt ? -1 : a.completedAt > b.completedAt ? 1 : a.id - b.id));

  const lines = [HEADER];
  for (const w of completed) {
    const plan = w.planId === null ? '' : (lookup.planName(w.planId) ?? '');
    for (const e of w.exercises) {
      const name = lookup.exerciseName(e.exerciseId);
      let working = 0;
      e.sets.forEach((s, i) => {
        // Undone working sets count too: the logger creates one set per prescribed set.
        const prescribed = s.kind === 'working' ? e.prescription?.sets[working++] : undefined;
        if (!s.done) return;
        const cells = [
          w.completedAt,
          w.name,
          plan,
          w.phase,
          e.exerciseId,
          name,
          String(i + 1),
          s.kind,
          formatNumber(s.weightKg),
          formatNumber(s.reps),
          formatNumber(s.rir),
          formatNumber(prescribed?.kg ?? null),
          formatNumber(prescribed?.reps ?? null),
          formatNumber(prescribed?.percent ?? null),
        ];
        lines.push(cells.map(field).join(','));
      });
    }
  }
  return lines.map((l) => `${l}\r\n`).join('');
}

export function csvFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `cycle-logbook-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}.csv`;
}
