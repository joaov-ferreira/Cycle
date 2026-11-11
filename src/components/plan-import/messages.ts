import { useCallback } from 'react';

import type { ImportError } from '@/domain/plan-import';
import { useI18n, type MessageKey, type TFunction } from '@/i18n';

/** Localized text of an import error: "Line 3: …" for text errors, "workouts[0].name: …" for JSON. */
export function describeImportError(t: TFunction, error: ImportError): string {
  const key: MessageKey = `planImport.errors.${error.code}`;
  const message = t(key);
  if (error.line !== undefined) {
    return t('planImport.input.errorLine', { where: t('planImport.input.line', { line: error.line }), message });
  }
  if (error.path) return t('planImport.input.errorLine', { where: error.path, message });
  return message;
}

/** `4 × 8–12` (or `4 × 10` when min equals max), numbers formatted for the UI locale. */
export function useTargetLabel(): (sets: number, repMin: number, repMax: number) => string {
  const { t, formatNumber } = useI18n();
  return useCallback(
    (sets, repMin, repMax) =>
      t('planImport.target', {
        sets,
        reps:
          repMin === repMax
            ? formatNumber(repMin)
            : t('planImport.repRange', { min: repMin, max: repMax }),
      }),
    [t, formatNumber],
  );
}
