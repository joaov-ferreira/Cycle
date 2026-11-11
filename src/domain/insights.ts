/**
 * Insights of the Progress and Home screens (SPEC-v3 §10): training calendar, week streak and
 * weekly trends. Pure: no I/O, no clocks (the reference time is passed in), no display strings.
 *
 * Only completed workouts (`status === 'completed'` with a `completedAt`) count. Dates are read
 * in local time through the `Date` getters.
 */
import type { Exercise, MuscleGroup } from './exercise';
import { isoWeekStart, weeklyMuscleSets } from './stats';
import { workoutSummary, type Workout } from './workout';

/** Trained-day entry of the calendar: completed workouts that day and whether any was a deload. */
export type TrainingDay = { count: number; deload: boolean };

/** One ISO week of the weekly trends (SPEC-v3 §10). */
export interface WeekTrend {
  /** Monday 00:00 (local) of the week. */
  weekStart: Date;
  sessions: number;
  volumeKg: number;
  setsByMuscle: Partial<Record<MuscleGroup, number>>;
}

/** Local date of a completed workout, or `null` for a workout still in progress. */
function completedDate(workout: Workout): Date | null {
  return workout.status === 'completed' && workout.completedAt !== null
    ? new Date(workout.completedAt)
    : null;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** The local calendar date as `YYYY-MM-DD`. */
export function localDateKey(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  return `${year}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Trained days of a month (`month` 1–12) by local date: completed workouts and deload flag. */
export function trainingDays(
  workouts: readonly Workout[],
  year: number,
  month: number,
): Record<string, TrainingDay> {
  const days: Record<string, TrainingDay> = {};
  for (const workout of workouts) {
    const date = completedDate(workout);
    if (date === null || date.getFullYear() !== year || date.getMonth() + 1 !== month) continue;
    const key = localDateKey(date);
    const day = days[key] ?? { count: 0, deload: false };
    day.count += 1;
    if (workout.phase === 'deload') day.deload = true;
    days[key] = day;
  }
  return days;
}

/** Number of completed workouts in a month (`month` 1–12). */
export function monthWorkoutCount(workouts: readonly Workout[], year: number, month: number): number {
  let count = 0;
  for (const workout of workouts) {
    const date = completedDate(workout);
    if (date !== null && date.getFullYear() === year && date.getMonth() + 1 === month) count += 1;
  }
  return count;
}

/** Monday 00:00 (local) `weeks` weeks after (or before, when negative) the given Monday. */
function shiftWeeks(weekStart: Date, weeks: number): Date {
  return new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 7 * weeks);
}

/**
 * Consecutive ISO weeks with at least one completed workout, counting back from the current
 * week. A current week without a workout yet does not break the streak: counting then starts at
 * the previous week. 0 when neither of the two has a workout.
 */
export function weekStreak(workouts: readonly Workout[], today: Date): number {
  const trainedWeeks = new Set<number>();
  for (const workout of workouts) {
    const date = completedDate(workout);
    if (date !== null) trainedWeeks.add(isoWeekStart(date).getTime());
  }

  let cursor = isoWeekStart(today);
  if (!trainedWeeks.has(cursor.getTime())) cursor = shiftWeeks(cursor, 1);

  let streak = 0;
  while (trainedWeeks.has(cursor.getTime())) {
    streak += 1;
    cursor = shiftWeeks(cursor, 1);
  }
  return streak;
}

/**
 * Sessions, volume and sets per muscle group of each of the last `weeks` ISO weeks, ending with
 * the current one, oldest first. Weeks without workouts appear with zeros and no sets.
 */
export function weeklyTrends(
  workouts: readonly Workout[],
  findExercise: (id: string) => Pick<Exercise, 'primaryMuscle' | 'secondaryMuscles'> | undefined,
  today: Date,
  weeks = 8,
): WeekTrend[] {
  const currentWeek = isoWeekStart(today);
  const trends: WeekTrend[] = [];
  for (let back = weeks - 1; back >= 0; back -= 1) {
    const weekStart = shiftWeeks(currentWeek, back);
    const weekEnd = shiftWeeks(weekStart, -1).getTime();
    const inWeek = workouts.filter((workout) => {
      const date = completedDate(workout);
      return date !== null && date.getTime() >= weekStart.getTime() && date.getTime() < weekEnd;
    });

    let volumeKg = 0;
    for (const workout of inWeek) volumeKg += workoutSummary(workout).volumeKg;

    trends.push({
      weekStart,
      sessions: inWeek.length,
      volumeKg,
      setsByMuscle: weeklyMuscleSets(inWeek, findExercise, weekStart),
    });
  }
  return trends;
}

/**
 * The month as rows of 7 cells, Monday first; `null` for the cells outside the month. The last
 * row is padded with `null` cells.
 */
export function calendarGrid(year: number, month: number): (number | null)[][] {
  const leadingBlanks = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: (number | null)[] = Array.from({ length: leadingBlanks }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let start = 0; start < cells.length; start += 7) rows.push(cells.slice(start, start + 7));
  return rows;
}
