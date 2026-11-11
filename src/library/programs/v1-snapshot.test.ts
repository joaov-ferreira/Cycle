/**
 * Rule 1 of SPEC-v4 §4.1: the program numbers are the v1 transcription, moved without changing a
 * number. `__fixtures__/v1-prescriptions.json` pins every template to the v1 data.
 *
 * How the fixture was produced (once, by a throwaway script that is not committed): the v1 sources
 * were extracted with `git archive 3774916 src/programs src/domain/lifts.ts`, transpiled to CommonJS
 * with the `typescript` package, and every template of the v1 registry (`listTemplates()`) was walked
 * and printed as the canonical lines below, in registry order. The v1 lift `selected` is the v4
 * role `lift`; v1 accessories (`{ name, text }`) are compared through their text
 * (`<n> sets × <m> reps`). Role ids, `defaultExerciseId` and exercise ids are v4 additions and are
 * not part of the snapshot; every other field (source, version, verification, parameters, phases,
 * day labels, sets, percentages, increments, AMRAP, unverified flags, notes) is.
 */
import type { ProgramSet, ProgramText, ProgramTemplate } from '../../domain/program';
import fixture from './__fixtures__/v1-prescriptions.json';
import { PROGRAMS } from './index';

const text = (t: ProgramText | undefined): string => (t ? `${t.en}/${t['pt-BR'] ?? ''}` : '');
const num = (n: number | undefined): string => (n === undefined ? '-' : String(n));

function setLine(s: ProgramSet): string {
  let line = `${s.repeat ?? 1}x${s.reps}@${num(s.percent)}`;
  if (s.percentParam) line += `;p=${s.percentParam}`;
  if (s.addKg) line += 'param' in s.addKg ? `;kg=${s.addKg.param}*${s.addKg.times ?? 1}` : `;kg=${s.addKg.kg}`;
  if (s.amrap) line += ';amrap';
  if (s.unverified) line += ';unverified';
  if (s.note) line += `;note=${text(s.note)}`;
  return line;
}

/** The same canonical lines the v1 fixture holds, computed from a v4 template. */
export function canonicalLines(t: ProgramTemplate): string[] {
  const lines: string[] = [
    `meta|${t.id}|${t.family}|${t.name}|${t.variant ?? ''}|${t.version}|${t.verification}|${t.durationWeeks}|${t.daysPerWeek}`,
    `source|${JSON.stringify(t.source)}`,
  ];
  for (const p of t.configurable ?? []) {
    lines.push(`param|${p.id}|${text(p.label)}|${p.unit}|${p.min}|${p.max}|${num(p.step)}|${p.default}|${p.source}`);
  }
  for (const w of t.weeks) {
    const wp = `w${w.week}`;
    lines.push(`${wp}|phase|${text(w.phase)}`);
    for (const d of w.days) {
      const dp = `${wp}|d${d.day}`;
      lines.push(`${dp}|label|${text(d.label)}`);
      d.items.forEach((it, i) => {
        const ip = `${dp}|#${i}`;
        if (it.kind === 'main') {
          lines.push(
            `${ip}|main|${it.role}|${it.variation ? text(it.variation.name) : ''}|${it.sets.map(setLine).join(',')}|note=${text(it.note)}`,
          );
        } else if (it.kind === 'accessory') {
          const sets = `${it.sets} sets × ${it.reps} reps/${it.sets} séries × ${it.reps} repetições`;
          lines.push(`${ip}|accessory|${text(it.name)}|${sets}|note=${text(it.note)}`);
        } else {
          lines.push(`${ip}|info|${it.role ?? ''}|${text(it.text)}|${it.unverified ? 'unverified' : ''}|note=${text(it.note)}`);
        }
      });
    }
  }
  return lines;
}

const V1: Record<string, string[]> = fixture;

describe('v1 snapshot (SPEC-v4 §4.1 rule 1)', () => {
  it('covers exactly the eight v1 templates in display order', () => {
    expect(Object.keys(V1)).toEqual([
      'cycle-531-custom',
      'smolov-jr',
      'smolov',
      'sheiko-29',
      'sheiko-30',
      'sheiko-31',
      'sheiko-32',
      'sheiko-37',
    ]);
    expect(PROGRAMS.map((p) => p.id)).toEqual(Object.keys(V1));
  });

  it.each(Object.keys(V1))('%s keeps every v1 number, source, version and note', (id) => {
    const template = PROGRAMS.find((p) => p.id === id);
    expect(template).toBeDefined();
    expect(canonicalLines(template as ProgramTemplate)).toEqual(V1[id]);
  });
});
