import type { ProgramTemplate } from '../schema';
import {
  acc,
  ACCESSORY,
  main,
  s,
  SHEIKO_UNDER_80_URL,
  sheikoTemplate,
  variation,
  VARIATION,
} from './sheiko-common';

/**
 * Sheiko #37 (SPEC §3.3-D): one month, three days a week. Transcribed from the adopted spreadsheet
 * tab “#37”; sources and cross-checks in docs/DECISIONS.md, Stage 9. Notation: s(sets, reps, fraction of 1RM).
 */
export const sheiko37: ProgramTemplate = sheikoTemplate({
  number: 37,
  crossChecks:
    `Checked set by set against Lift Vault’s “Sheiko 3 Day Under 80 kg” workbook, tab “#37” (${SHEIKO_UNDER_80_URL}): ` +
    'every set and accessory agrees. The “#37v2” tab of the over-80 kg workbook is a different variant and was not used.',
  weeks: [
    // Week 1
    [
      // Day 1 — Monday
      [
        main('bench', s(1, 5, 0.5), s(2, 4, 0.6), s(2, 3, 0.7), s(5, 3, 0.75)),
        main('squat', s(1, 5, 0.5), s(2, 5, 0.6), s(5, 5, 0.7)),
        acc(ACCESSORY.dumbbellFly, 5, 10),
        main('bench', s(1, 6, 0.5), s(2, 6, 0.6), s(4, 6, 0.65)),
        acc(ACCESSORY.goodMorningStanding, 5, 5),
      ],
      // Day 2 — Wednesday
      [
        main('deadlift', s(1, 5, 0.5), s(2, 5, 0.6), s(2, 4, 0.7), s(4, 3, 0.75)),
        acc(ACCESSORY.inclineBench, 6, 4),
        acc(ACCESSORY.dip, 5, 5),
        variation('deadlift', VARIATION.deadliftFromBoxes, s(1, 5, 0.5), s(2, 5, 0.6), s(2, 4, 0.7), s(4, 3, 0.8)),
        acc(ACCESSORY.lunge, 5, 5),
        acc(ACCESSORY.abs, 3, 10),
      ],
      // Day 3 — Friday
      [
        main('bench', s(1, 7, 0.5), s(1, 6, 0.55), s(1, 5, 0.6), s(1, 4, 0.65), s(2, 3, 0.7), s(2, 2, 0.75), s(2, 3, 0.7), s(1, 4, 0.65), s(1, 6, 0.6), s(1, 8, 0.55), s(1, 10, 0.5)),
        acc(ACCESSORY.dumbbellFly, 5, 10),
        main('squat', s(1, 5, 0.5), s(2, 4, 0.6), s(2, 3, 0.7), s(5, 3, 0.75)),
        acc(ACCESSORY.frenchPress, 5, 10),
        acc(ACCESSORY.goodMorningSitting, 5, 5),
      ],
    ],
    // Week 2
    [
      // Day 1 — Monday
      [
        main('squat', s(1, 5, 0.5), s(2, 4, 0.6), s(2, 3, 0.7), s(5, 2, 0.8)),
        main('bench', s(1, 5, 0.5), s(1, 4, 0.6), s(2, 3, 0.7), s(6, 2, 0.8)),
        acc(ACCESSORY.dumbbellFly, 5, 10),
        acc(ACCESSORY.pushUp, 5, 10),
        main('squat', s(1, 3, 0.55), s(1, 3, 0.65), s(4, 3, 0.75)),
        acc(ACCESSORY.goodMorningStanding, 5, 5),
      ],
      // Day 2 — Wednesday
      [
        variation('deadlift', VARIATION.deadliftToKnees, s(1, 4, 0.5), s(2, 4, 0.6), s(4, 4, 0.7)),
        main('bench', s(1, 5, 0.5), s(2, 5, 0.6), s(5, 4, 0.7)),
        acc(ACCESSORY.dumbbellFly, 5, 10),
        main('deadlift', s(1, 4, 0.5), s(1, 4, 0.6), s(2, 3, 0.7), s(5, 3, 0.75)),
        acc(ACCESSORY.lunge, 5, 5),
      ],
      // Day 3 — Friday
      [
        main('squat', s(1, 4, 0.5), s(1, 4, 0.6), s(2, 3, 0.7), s(6, 3, 0.75)),
        main('bench', s(1, 6, 0.5), s(1, 5, 0.6), s(2, 4, 0.7), s(2, 3, 0.75), s(2, 2, 0.8), s(1, 4, 0.75), s(1, 5, 0.7), s(1, 6, 0.6), s(1, 7, 0.5)),
        acc(ACCESSORY.dumbbellFly, 5, 10),
        acc(ACCESSORY.triceps, 5, 10),
        main('squat', s(1, 3, 0.55), s(1, 3, 0.65), s(4, 2, 0.75)),
        acc(ACCESSORY.goodMorningSitting, 5, 6),
      ],
    ],
    // Week 3
    [
      // Day 1 — Monday
      [
        main('squat', s(1, 5, 0.5), s(2, 4, 0.6), s(2, 3, 0.7), s(5, 3, 0.8)),
        main('bench', s(1, 5, 0.5), s(1, 4, 0.6), s(2, 3, 0.7), s(5, 3, 0.8)),
        acc(ACCESSORY.dumbbellFly, 5, 10),
        acc(ACCESSORY.pushUp, 5, 10),
        main('squat', s(1, 5, 0.5), s(1, 5, 0.6), s(5, 5, 0.7)),
        acc(ACCESSORY.abs, 3, 10),
      ],
      // Day 2 — Wednesday
      [
        variation('deadlift', VARIATION.deadliftToKnees, s(1, 4, 0.5), s(1, 4, 0.6), s(2, 4, 0.7), s(4, 4, 0.75)),
        main('bench', s(1, 6, 0.5), s(1, 5, 0.6), s(2, 4, 0.7), s(2, 3, 0.75), s(2, 2, 0.8), s(2, 3, 0.75), s(1, 4, 0.7), s(1, 5, 0.65), s(1, 6, 0.6), s(1, 7, 0.55), s(1, 8, 0.5)),
        acc(ACCESSORY.dumbbellFly, 5, 10),
        variation('deadlift', VARIATION.deadliftFromBoxes, s(1, 5, 0.6), s(2, 5, 0.7), s(4, 4, 0.8)),
        acc(ACCESSORY.lunge, 5, 5),
        acc(ACCESSORY.abs, 3, 10),
      ],
      // Day 3 — Friday
      [
        main('bench', s(1, 5, 0.5), s(1, 4, 0.6), s(2, 3, 0.7), s(5, 2, 0.8)),
        main('squat', s(1, 5, 0.5), s(1, 5, 0.6), s(2, 5, 0.7), s(5, 4, 0.75)),
        main('bench', s(1, 6, 0.5), s(2, 6, 0.6), s(4, 6, 0.65)),
        acc(ACCESSORY.dumbbellFly, 5, 10),
        acc(ACCESSORY.goodMorningStanding, 5, 5),
      ],
    ],
    // Week 4
    [
      // Day 1 — Monday
      [
        main('squat', s(1, 5, 0.5), s(1, 4, 0.6), s(2, 3, 0.7), s(2, 3, 0.8), s(3, 2, 0.85)),
        main('bench', s(1, 5, 0.5), s(1, 4, 0.6), s(2, 3, 0.7), s(5, 3, 0.8)),
        acc(ACCESSORY.dumbbellFly, 5, 10),
        acc(ACCESSORY.dip, 5, 8),
        main('squat', s(1, 5, 0.5), s(1, 4, 0.6), s(2, 3, 0.7), s(4, 2, 0.8)),
        acc(ACCESSORY.goodMorningStanding, 5, 5),
      ],
      // Day 2 — Wednesday
      [
        main('bench', s(1, 5, 0.5), s(1, 4, 0.6), s(2, 3, 0.7), s(2, 3, 0.8), s(3, 2, 0.85)),
        main('deadlift', s(1, 4, 0.5), s(1, 4, 0.6), s(2, 3, 0.7), s(2, 3, 0.8), s(3, 2, 0.85)),
        main('bench', s(1, 5, 0.55), s(1, 5, 0.65), s(4, 4, 0.75)),
        acc(ACCESSORY.dumbbellFly, 5, 10),
        acc(ACCESSORY.lunge, 5, 5),
      ],
      // Day 3 — Friday
      [
        main('squat', s(1, 5, 0.5), s(1, 4, 0.6), s(2, 3, 0.7), s(6, 3, 0.8)),
        main('bench', s(1, 5, 0.5), s(1, 5, 0.6), s(5, 5, 0.7)),
        acc(ACCESSORY.dumbbellFly, 5, 10),
        acc(ACCESSORY.dip, 5, 8),
        acc(ACCESSORY.goodMorningSitting, 5, 5),
        acc(ACCESSORY.abs, 3, 10),
      ],
    ],
  ],
});
