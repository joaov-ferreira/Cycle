import type { ProgramTemplate } from '../../../domain/program';
import {
  acc,
  ACCESSORY,
  LIFTOSAUR_29_32_URL,
  main,
  s,
  sheikoTemplate,
  VARIATION,
  variation,
} from './sheiko-common';

/**
 * Sheiko #31 (SPEC §3.3-D): one month, three days a week. Transcribed from the adopted spreadsheet
 * tab “#31”; the 70% squat ladders are one set per listed rep count, in the source order. Sources and
 * cross-checks in docs/DECISIONS.md, Stage 9. Notation: s(sets, reps, fraction of 1RM).
 */
export const sheiko31: ProgramTemplate = sheikoTemplate({
  number: 31,
  crossChecks:
    `Checked set by set against Liftosaur, “Sheiko #29-32”, weeks 9–12 (${LIFTOSAUR_29_32_URL}): every ` +
    'main-lift set agrees. Liftosaur substitutes some accessories; the spreadsheet’s are kept. The “#31” tab of ' +
    'Lift Vault’s “Sheiko 3 Day Over 80 kg” workbook is a different variant and was not used.',
  weeks: [
    // Week 1
    [
      // Day 1 — Monday
      [
        main('bench', s(1, 5, 0.5), s(1, 4, 0.6), s(2, 3, 0.7), s(2, 3, 0.8), s(4, 2, 0.85)),
        main('squat', s(1, 5, 0.5), s(2, 5, 0.6), s(1, 2, 0.7), s(1, 4, 0.7), s(1, 6, 0.7), s(1, 8, 0.7), s(1, 7, 0.7), s(1, 5, 0.7), s(1, 3, 0.7)),
        main('bench', s(1, 6, 0.5), s(2, 6, 0.6), s(4, 6, 0.65)),
        acc(ACCESSORY.dumbbellFly, 5, 10),
        main('squat', s(1, 5, 0.5), s(2, 5, 0.6), s(4, 4, 0.65)),
        acc(ACCESSORY.goodMorningStanding, 5, 5),
      ],
      // Day 2 — Wednesday
      [
        variation('deadlift', VARIATION.deadliftToKnees, s(1, 4, 0.5), s(2, 4, 0.6), s(4, 4, 0.7)),
        main('bench', s(1, 5, 0.5), s(1, 5, 0.6), s(2, 4, 0.7), s(2, 3, 0.75), s(2, 2, 0.8), s(2, 1, 0.85), s(2, 2, 0.8), s(2, 3, 0.75), s(1, 4, 0.7), s(1, 6, 0.65), s(1, 8, 0.6), s(1, 10, 0.55), s(1, 12, 0.5)),
        acc(ACCESSORY.dumbbellFly, 5, 10),
        variation('deadlift', VARIATION.deadliftFromBoxes, s(1, 5, 0.6), s(1, 4, 0.7), s(2, 3, 0.8), s(4, 2, 0.9)),
        acc(ACCESSORY.lunge, 5, 5),
        acc(ACCESSORY.abs, 3, 10),
      ],
      // Day 3 — Friday
      [
        main('squat', s(1, 5, 0.5), s(1, 4, 0.6), s(2, 3, 0.7), s(2, 3, 0.8), s(3, 2, 0.85)),
        main('bench', s(1, 5, 0.5), s(2, 4, 0.6), s(2, 3, 0.7), s(6, 2, 0.8)),
        acc(ACCESSORY.dip, 5, 6),
        main('squat', s(1, 5, 0.55), s(1, 5, 0.65), s(4, 4, 0.75)),
        acc(ACCESSORY.frenchPress, 5, 10),
        acc(ACCESSORY.goodMorningSitting, 5, 5),
      ],
    ],
    // Week 2
    [
      // Day 1 — Monday
      [
        main('bench', s(1, 5, 0.5), s(1, 4, 0.6), s(2, 3, 0.7), s(2, 2, 0.8), s(3, 1, 0.9)),
        main('squat', s(1, 5, 0.5), s(1, 4, 0.6), s(2, 3, 0.7), s(5, 2, 0.8)),
        main('bench', s(1, 5, 0.55), s(1, 5, 0.65), s(4, 5, 0.75)),
        acc(ACCESSORY.dumbbellFly, 5, 10),
        acc(ACCESSORY.legPress, 5, 6),
        acc(ACCESSORY.goodMorningStanding, 5, 5),
      ],
      // Day 2 — Wednesday
      [
        variation('deadlift', VARIATION.deficitDeadlift, s(1, 3, 0.5), s(2, 3, 0.6), s(4, 3, 0.65)),
        main('bench', s(1, 6, 0.5), s(1, 5, 0.6), s(2, 4, 0.7), s(2, 3, 0.75), s(2, 2, 0.8), s(2, 1, 0.85), s(1, 3, 0.75), s(1, 5, 0.65), s(1, 7, 0.55)),
        acc(ACCESSORY.dumbbellFly, 5, 10),
        main('deadlift', s(1, 3, 0.55), s(2, 3, 0.65), s(2, 3, 0.75), s(4, 2, 0.85)),
        acc(ACCESSORY.lunge, 5, 5),
        acc(ACCESSORY.abs, 4, 10),
      ],
      // Day 3 — Friday
      [
        main('squat', s(1, 5, 0.5), s(1, 4, 0.6), s(2, 3, 0.7), s(2, 2, 0.8), s(4, 2, 0.85)),
        acc(ACCESSORY.inclineBench, 6, 4),
        main('squat', s(1, 6, 0.5), s(1, 6, 0.6), s(4, 6, 0.65)),
        acc(ACCESSORY.triceps, 5, 10),
        acc(ACCESSORY.backExtension, 4, 10),
      ],
    ],
    // Week 3
    [
      // Day 1 — Monday
      [
        main('bench', s(1, 5, 0.5), s(1, 4, 0.6), s(2, 3, 0.7), s(5, 3, 0.8)),
        main('squat', s(1, 5, 0.5), s(1, 5, 0.6), s(1, 5, 0.7), s(1, 8, 0.7), s(1, 3, 0.7), s(1, 6, 0.7), s(1, 2, 0.7), s(1, 7, 0.7), s(1, 4, 0.7)),
        main('bench', s(1, 5, 0.55), s(1, 5, 0.65), s(5, 5, 0.7)),
        acc(ACCESSORY.dumbbellFly, 5, 10),
        acc(ACCESSORY.lunge, 5, 5),
        acc(ACCESSORY.goodMorningStanding, 5, 5),
      ],
      // Day 2 — Wednesday
      [
        variation('deadlift', VARIATION.deadliftToKnees, s(1, 4, 0.5), s(1, 4, 0.6), s(2, 3, 0.7), s(4, 2, 0.8)),
        main('bench', s(1, 8, 0.5), s(1, 7, 0.55), s(1, 6, 0.6), s(1, 5, 0.65), s(1, 4, 0.7), s(2, 3, 0.75), s(2, 2, 0.8), s(2, 1, 0.85), s(2, 2, 0.8), s(1, 3, 0.75), s(1, 4, 0.7), s(1, 6, 0.65), s(1, 8, 0.6), s(1, 10, 0.55), s(1, 12, 0.5)),
        variation('deadlift', VARIATION.deadliftFromBoxes, s(1, 4, 0.6), s(1, 4, 0.7), s(2, 3, 0.8), s(3, 2, 0.9)),
        acc(ACCESSORY.legPress, 5, 5),
        acc(ACCESSORY.abs, 3, 10),
      ],
      // Day 3 — Friday
      [
        main('bench', s(1, 5, 0.5), s(1, 4, 0.6), s(2, 3, 0.7), s(6, 3, 0.8)),
        main('squat', s(1, 5, 0.5), s(1, 4, 0.6), s(2, 3, 0.7), s(2, 3, 0.8), s(3, 2, 0.85), s(3, 3, 0.8)),
        main('bench', s(1, 5, 0.5), s(2, 5, 0.6), s(5, 5, 0.7)),
        acc(ACCESSORY.dumbbellFly, 5, 10),
        acc(ACCESSORY.goodMorningSitting, 5, 5),
      ],
    ],
    // Week 4
    [
      // Day 1 — Monday
      [
        main('squat', s(1, 5, 0.5), s(1, 4, 0.6), s(2, 3, 0.7), s(2, 2, 0.8), s(3, 1, 0.9), s(2, 2, 0.8)),
        main('bench', s(1, 5, 0.5), s(1, 4, 0.6), s(2, 3, 0.7), s(2, 3, 0.8), s(4, 2, 0.85)),
        acc(ACCESSORY.dumbbellFly, 5, 10),
        acc(ACCESSORY.dip, 5, 8),
        acc(ACCESSORY.lunge, 5, 5),
        acc(ACCESSORY.backExtension, 4, 10),
      ],
      // Day 2 — Wednesday
      [
        main('bench', s(1, 5, 0.5), s(1, 4, 0.6), s(2, 3, 0.7), s(2, 2, 0.8), s(3, 1, 0.9), s(2, 2, 0.8)),
        main('deadlift', s(1, 3, 0.5), s(1, 3, 0.6), s(2, 3, 0.7), s(2, 2, 0.8), s(2, 1, 0.9)),
        acc(ACCESSORY.dumbbellFly, 5, 10),
        acc(ACCESSORY.legPress, 6, 5),
        acc(ACCESSORY.abs, 3, 10),
      ],
      // Day 3 — Friday
      [
        main('squat', s(1, 5, 0.5), s(1, 4, 0.6), s(2, 3, 0.7), s(5, 3, 0.8)),
        main('bench', s(1, 5, 0.55), s(1, 5, 0.65), s(5, 4, 0.75)),
        acc(ACCESSORY.dumbbellFly, 5, 10),
        acc(ACCESSORY.dip, 5, 8),
        main('squat', s(1, 5, 0.5), s(1, 5, 0.6), s(4, 5, 0.7)),
        acc(ACCESSORY.goodMorningSitting, 5, 5),
      ],
    ],
  ],
});
