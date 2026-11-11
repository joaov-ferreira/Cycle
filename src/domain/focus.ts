/** Training focus chosen in onboarding and Settings (SPEC-v4 §1, §10.6). Pure. */

export const TRAINING_FOCUSES = ['general', 'strength'] as const;
export type TrainingFocus = (typeof TRAINING_FOCUSES)[number];

export const DEFAULT_TRAINING_FOCUS: TrainingFocus = 'general';

export const isTrainingFocus = (value: unknown): value is TrainingFocus =>
  typeof value === 'string' && (TRAINING_FOCUSES as readonly string[]).includes(value);
