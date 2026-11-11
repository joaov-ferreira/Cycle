/** i18n keys of the strength enums, shared by the 1RM screens, Settings and the onboarding. */
import type { E1rmConfidence, E1rmFormula } from '@/domain/e1rm';
import type { EffortScale } from '@/domain/effort';
import type { TrainingFocus } from '@/domain/focus';
import type { ReferenceMaxOrigin } from '@/domain/reference-max';
import type { RoundingMode } from '@/domain/rounding';
import type { MessageKey } from '@/i18n';

export const ORIGIN_KEYS = {
  manual: 'maxes.origin.manual',
  fromE1rm: 'maxes.origin.fromE1rm',
  onboarding: 'maxes.origin.onboarding',
  import: 'maxes.origin.import',
  v1: 'maxes.origin.v1',
} as const satisfies Record<ReferenceMaxOrigin, MessageKey>;

export const FORMULA_LABEL_KEYS = {
  epley: 'settings.strength.formula.epley.label',
  brzycki: 'settings.strength.formula.brzycki.label',
  rts: 'settings.strength.formula.rts.label',
} as const satisfies Record<E1rmFormula, MessageKey>;

export const FORMULA_DESCRIPTION_KEYS = {
  epley: 'settings.strength.formula.epley.description',
  brzycki: 'settings.strength.formula.brzycki.description',
  rts: 'settings.strength.formula.rts.description',
} as const satisfies Record<E1rmFormula, MessageKey>;

export const ROUNDING_LABEL_KEYS = {
  nearest: 'settings.strength.rounding.nearest.label',
  down: 'settings.strength.rounding.down.label',
  up: 'settings.strength.rounding.up.label',
} as const satisfies Record<RoundingMode, MessageKey>;

export const ROUNDING_DESCRIPTION_KEYS = {
  nearest: 'settings.strength.rounding.nearest.description',
  down: 'settings.strength.rounding.down.description',
  up: 'settings.strength.rounding.up.description',
} as const satisfies Record<RoundingMode, MessageKey>;

export const FOCUS_LABEL_KEYS = {
  general: 'settings.strength.focus.general.label',
  strength: 'settings.strength.focus.strength.label',
} as const satisfies Record<TrainingFocus, MessageKey>;

export const FOCUS_DESCRIPTION_KEYS = {
  general: 'settings.strength.focus.general.description',
  strength: 'settings.strength.focus.strength.description',
} as const satisfies Record<TrainingFocus, MessageKey>;

export const EFFORT_LABEL_KEYS = {
  rir: 'settings.strength.effort.rir',
  rpe: 'settings.strength.effort.rpe',
} as const satisfies Record<EffortScale, MessageKey>;

export const EFFORT_HINT_KEYS = {
  rir: 'maxes.effort.emptyHint.rir',
  rpe: 'maxes.effort.emptyHint.rpe',
} as const satisfies Record<EffortScale, MessageKey>;

export const CONFIDENCE_KEYS = {
  normal: 'maxes.estimate.confidence.normal',
  low: 'maxes.estimate.confidence.low',
} as const satisfies Record<E1rmConfidence, MessageKey>;
