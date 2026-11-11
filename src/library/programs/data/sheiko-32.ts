import type { ProgramTemplate } from '../../../domain/program';
import {
  acc,
  ACCESSORY,
  COMPETITION,
  DAYS_5_TO_7,
  main,
  maxAttempts,
  s,
  SHEIKO_UNDER_80_URL,
  sheikoTemplate,
  VARIATION,
  variation,
} from './sheiko-common';

/**
 * Sheiko #32 (SPEC §3.3-D): the competition month — max attempts in week 1, taper, competition at the
 * end of week 4. Transcribed from the adopted spreadsheet tab “#32”; sources and cross-checks in
 * docs/DECISIONS.md, Stage 9. Notation: s(sets, reps, fraction of 1RM).
 */
export const sheiko32: ProgramTemplate = sheikoTemplate({
  number: 32,
  crossChecks:
    `Checked set by set against Lift Vault’s “Sheiko 3 Day Under 80 kg” workbook, tab “#32” (${SHEIKO_UNDER_80_URL}): ` +
    'every set and accessory agrees. Liftosaur (weeks 13–16) agrees too, except the week 1 max attempts ' +
    '(3 × 1 @ 100% instead of 2–3 × 1 @ 100–105%), which are therefore unverified and have no load.',
  weeks: [
    // Week 1
    [
      // Day 1 — Monday
      [
        main('squat', s(1, 3, 0.5), s(1, 3, 0.6), s(2, 3, 0.7), s(3, 2, 0.75)),
        main('bench', s(1, 3, 0.5), s(1, 3, 0.6), s(2, 3, 0.7), s(3, 2, 0.75)),
        acc(ACCESSORY.abs, 3, 10),
      ],
      // Day 2 — Wednesday
      [
        main('squat', s(1, 3, 0.5), s(2, 3, 0.6), s(2, 2, 0.7), s(1, 2, 0.8), s(1, 1, 0.9)),
        maxAttempts('squat'),
        main('bench', s(1, 3, 0.5), s(1, 3, 0.6), s(2, 2, 0.7), s(1, 2, 0.8), s(1, 1, 0.9)),
        maxAttempts('bench'),
        main('deadlift', s(1, 3, 0.5), s(1, 2, 0.6), s(2, 2, 0.7), s(1, 1, 0.8), s(1, 1, 0.9)),
        maxAttempts('deadlift'),
      ],
      // Day 3 — Friday
      [
        main('squat', s(1, 3, 0.5), s(2, 3, 0.6), s(2, 3, 0.7), s(4, 2, 0.75)),
        main('bench', s(1, 3, 0.55), s(2, 3, 0.65), s(6, 3, 0.75)),
        acc(ACCESSORY.dumbbellFly, 5, 10),
        acc(ACCESSORY.goodMorningStanding, 5, 5),
        acc(ACCESSORY.abs, 3, 10),
      ],
    ],
    // Week 2
    [
      // Day 1 — Monday
      [
        main('squat', s(1, 3, 0.5), s(2, 3, 0.6), s(2, 3, 0.7), s(4, 2, 0.8)),
        main('bench', s(1, 3, 0.5), s(1, 3, 0.6), s(2, 3, 0.7), s(5, 3, 0.8)),
        acc(ACCESSORY.dumbbellFly, 4, 8),
        main('squat', s(1, 3, 0.55), s(2, 3, 0.65), s(4, 3, 0.75)),
      ],
      // Day 2 — Wednesday
      [
        variation('deadlift', VARIATION.deadliftToKnees, s(1, 3, 0.5), s(2, 2, 0.6), s(2, 2, 0.65), s(3, 1, 0.7)),
        main('bench', s(1, 3, 0.5), s(1, 3, 0.6), s(2, 3, 0.7), s(2, 3, 0.8), s(3, 2, 0.85)),
        acc(ACCESSORY.dumbbellFly, 5, 10),
        main('deadlift', s(1, 3, 0.5), s(1, 3, 0.6), s(2, 3, 0.7), s(5, 3, 0.8)),
        acc(ACCESSORY.abs, 3, 10),
      ],
      // Day 3 — Friday
      [
        main('bench', s(1, 3, 0.5), s(1, 3, 0.6), s(2, 3, 0.7), s(5, 3, 0.8)),
        main('squat', s(1, 3, 0.5), s(2, 3, 0.6), s(2, 3, 0.7), s(6, 3, 0.8)),
        main('bench', s(1, 4, 0.5), s(1, 4, 0.6), s(4, 4, 0.7)),
        acc(ACCESSORY.dumbbellFly, 5, 10),
        acc(ACCESSORY.goodMorningStanding, 5, 5),
      ],
    ],
    // Week 3
    [
      // Day 1 — Monday
      [
        main('squat', s(1, 3, 0.5), s(1, 3, 0.6), s(2, 3, 0.7), s(5, 2, 0.8)),
        main('bench', s(1, 3, 0.5), s(1, 3, 0.6), s(2, 3, 0.7), s(3, 2, 0.8), s(3, 1, 0.85)),
        acc(ACCESSORY.dumbbellFly, 4, 8),
        acc(ACCESSORY.abs, 5, 4),
      ],
      // Day 2 — Wednesday
      [
        main('bench', s(1, 3, 0.5), s(1, 3, 0.6), s(2, 3, 0.7), s(5, 2, 0.8)),
        acc(ACCESSORY.dumbbellFly, 4, 8),
        main('deadlift', s(1, 3, 0.5), s(2, 3, 0.6), s(2, 3, 0.7), s(5, 2, 0.75)),
        acc(ACCESSORY.goodMorningStanding, 4, 5),
      ],
      // Day 3 — Friday
      [
        main('squat', s(1, 3, 0.5), s(2, 3, 0.6), s(2, 2, 0.7), s(3, 2, 0.75)),
        main('bench', s(1, 3, 0.5), s(1, 3, 0.6), s(2, 3, 0.7), s(4, 2, 0.75)),
        acc(ACCESSORY.abs, 3, 8),
      ],
    ],
    // Week 4
    [
      // Day 1 — Monday
      [
        main('bench', s(1, 3, 0.5), s(2, 3, 0.6), s(2, 2, 0.7), s(4, 1, 0.75)),
        main('deadlift', s(1, 3, 0.5), s(2, 2, 0.6), s(4, 2, 0.7)),
        acc(ACCESSORY.abs, 2, 8),
      ],
      // Day 2 — Wednesday
      [
        main('squat', s(1, 3, 0.5), s(2, 3, 0.6), s(3, 2, 0.7)),
        main('bench', s(1, 3, 0.5), s(2, 3, 0.6), s(3, 2, 0.7)),
      ],
      // Day 3 — days 5–7
      { label: DAYS_5_TO_7, items: [COMPETITION] },
    ],
  ],
});
