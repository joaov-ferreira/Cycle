/**
 * Test-only compact notation of a program day, so data tests can list a source table day by day:
 * `bench: 1x5@50 2x4@60` (sets × reps @ % of 1RM), `deadlift (Deadlift from boxes): 1x4@55`,
 * `acc Dumbbell fly: 5 sets × 10 reps`, `info squat unverified: …`. An unverified set is `@?`.
 */
import type { PrescriptionItem, ProgramTemplate, SetPrescription } from '@/programs/schema';

function setNotation(set: SetPrescription): string {
  const percent = set.unverified || set.percent === undefined ? '?' : String(Math.round(set.percent * 1000) / 10);
  return `${set.repeat ?? 1}x${set.reps}@${percent}`;
}

export function itemNotation(item: PrescriptionItem): string {
  switch (item.kind) {
    case 'main': {
      const exercise = item.exercise ? ` (${item.exercise.en})` : '';
      return `${item.lift}${exercise}: ${item.sets.map(setNotation).join(' ')}`;
    }
    case 'accessory':
      return `acc ${item.name.en}: ${item.text.en}`;
    case 'info':
      return ['info', item.lift, item.unverified ? 'unverified' : undefined].filter(Boolean).join(' ') + `: ${item.text.en}`;
  }
}

/** The items of `template` week `week`, day `day` (1-based) in notation. */
export function dayNotation(template: ProgramTemplate, week: number, day: number): string[] {
  return template.weeks[week - 1].days[day - 1].items.map(itemNotation);
}
