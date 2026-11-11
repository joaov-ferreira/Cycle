/// <reference types="node" />
import fs from 'fs';
import path from 'path';

import { catalogs, leafEntries } from './catalogs';

const SRC = path.resolve(__dirname, '..');

/**
 * Keys that code builds at run time (`t(`common.muscles.${muscle}`)`): every key under these
 * prefixes counts as referenced. Keep the list short and explain each entry.
 */
const DYNAMIC_PREFIXES = [
  'common.muscles.', // shared/labels.ts: one key per MuscleGroup
  'exercises.inUse', // exercise-detail-screen.tsx: t(`exercises.${message}`)
  'common.equipment.', // shared/labels.ts: one key per Equipment
  'plan.cycle.levels.', // cycle-settings.tsx: one key per Experience
  'planImport.errors.', // plan-import/messages.ts: one key per ImportErrorCode
  'planImport.issues.', // import-preview-step.tsx: one key per PlanIssueCode
  'progress.periods.', // progress-screen.tsx: one key per Period
  'progress.periodNames.', // line-chart.tsx: one key per Period
  'progress.metrics.', // progress-screen.tsx: one key per Metric
  'validation.', // NumberInput.tsx: one key per NumberValidationError
];

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'locales' || entry.name === 'test-utils' ? [] : sourceFiles(full);
    }
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe('catalog keys', () => {
  it('are all referenced by the code (no dead strings)', () => {
    const code = sourceFiles(SRC)
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n');
    const unused = leafEntries(catalogs.en as unknown as Record<string, unknown>)
      .map(([key]) => key)
      .filter((key) => !DYNAMIC_PREFIXES.some((prefix) => key.startsWith(prefix)))
      .filter((key) => !['\'', '"', '`'].some((quote) => code.includes(`${quote}${key}${quote}`)));
    expect(unused).toEqual([]);
  });
});
