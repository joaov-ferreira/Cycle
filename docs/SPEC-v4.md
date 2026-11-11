# CYCLE v4 — Specification ("strength mode")

> Extends [`SPEC.md`](./SPEC.md) (v2) and [`SPEC-v3.md`](./SPEC-v3.md). Where this document says
> otherwise, it wins. The v1 powerlifting spec it draws from is archived in
> [`archive/SPEC-v1.md`](./archive/SPEC-v1.md); the v1 code is in git history (last v1 commit:
> `3774916`).

- **Status:** approved for implementation
- **Goal:** one app for two ways of training. Somebody who lifts for muscle, health or general
  fitness keeps the v2/v3 app unchanged. Somebody who trains for strength (powerlifting or any
  percentage-based program) gets back what v2 removed — reference 1RMs, the program database
  (custom 5/3/1, Smolov Jr., Smolov, Sheiko), loads calculated from percentages of the 1RM, the
  periodization table, the RTS and Brzycki e1RM formulas and the e1RM history with "use as new 1RM"
  — **for any exercise of the library**, not for three hard-coded lifts. Both ways of training mix
  freely inside one plan.

## 0. What comes back, and how it changed

| v1 feature | v4 form |
|---|---|
| Three lifts (`bench`, `squat`, `deadlift`) as the app's axis | **Not restored.** Programs name *roles* ("the squat of this program") that the user maps to any exercise. |
| Reference 1RM per lift, versioned | Reference 1RM **per exercise** (any built-in or custom exercise), versioned (§2). v1 records are carried over. |
| Program database with sources and verification | Restored as `src/library/programs/` (§4). Variations and accessories point to library exercises. |
| Session slot = lift + program + day + block week | **Program block** inside a plan workout: program + day + start week + role → exercise mapping (§5.2). |
| Three-week periodization generator | The plan's cycle is the block. Loads for every cycle week are generated from the program blocks and percent schemes (§6) and shown in the **periodization table** (§10.4). |
| — | New: **custom percent scheme** on any plan exercise (§5.1), written in the editor, imported from JSON/text or produced by an AI chatbot (§9). |
| Rounding modes, exact → rounded load | Rounding-mode setting restored (§6.2). |
| Prescribed vs actual | Prescription snapshot on the logged exercise, deltas per set and per session (§7). |
| e1RM formulas `rts`, `epley-rir`, `brzycki-rir` | Formula setting; Epley stays the default (§3). |
| RIR ↔ RPE, half points | Effort-scale setting (RIR or RPE), half points allowed (§3.3). |
| e1RM history, "Use as new reference 1RM" | Derived from the logbook under the selected formula; strength dashboard and the action restored (§8). |
| Onboarding with the three 1RMs | Onboarding asks the training focus; the strength path asks 1RMs for exercises the user picks (§10.1). |

---

## 1. User journeys

The journeys below are the reference for every screen decision. A feature that does not serve one of
them is out of scope.

### 1.1 Marina — trains for muscle and health (general focus)

Nothing she did in v3 changes, and nothing new is required of her.

1. Onboarding → focus **"General training"** → experience → picks a template, imports a plan or
   starts later (v2 flow).
2. Logs workouts with double progression, deloads, timer, plates, warm-ups (v2/v3).
3. What v4 adds for her, all optional: a **1RM calculator** under More, the choice of e1RM formula,
   and — if she ever wants a strength block for one lift — "Add program block" in her plan editor.
4. She never sees an empty "1RMs" screen pushed at her: strength surfaces appear on Home and
   Progress only when the profile focus is strength or at least one reference 1RM exists.

### 1.2 Rafael — powerlifter (strength focus)

1. **Onboarding** → focus **"Strength"** → experience → **"Your lifts"**: three suggested rows
   (Back Squat, Bench Press, Deadlift) that he can remove, plus "Add exercise" (any library
   exercise). Each row takes a 1RM in kg, or "Estimate from a set" (weight × reps @ RIR/RPE). Rows
   may stay empty.
2. **Choose a program**: the program library — name, family, duration, days per week, source and a
   verification badge. The detail screen shows the full original structure week by week.
3. **Start program** (wizard): map each role of the program to an exercise (defaults offered; e.g.
   Sheiko's deadlift → Sumo Deadlift), set the program's parameters (Smolov Jr. increment, 5/3/1
   percentages), confirm or enter the missing 1RMs → the app creates a plan with one workout per
   program day, a cycle as long as the program and no deload, and makes it active.
4. **Periodization table** (from the Plan tab): every cycle week × workout with sets × reps @ % →
   exact kg → rounded kg and the weekly tonnage. Changing a 1RM, an increment or a parameter updates
   it at once.
5. **Train**: the logger opens with the day's prescription generated — weights pre-filled, reps
   pre-set (ticking a set confirms the prescribed reps), AMRAP sets marked. Plates, warm-ups and the
   rest timer work as in v3. After each set with an effort value the row shows "e1RM ≈ 96 kg".
6. **Finish**: the summary shows, per exercise with a reference 1RM, the session's e1RM against the
   previous one and prescribed vs actual tonnage; "Use as new 1RM" (explicit confirmation) is offered
   when the estimate beats the reference.
7. **Strength tab** in Progress: one card per exercise with a reference 1RM — current reference,
   latest / previous / best e1RM, improvement over the period, chart with e1RM points and reference
   steps.
8. **End of the block**: the cycle report (v3) gains a "Programs and 1RMs" section — what was
   completed, a suggested 1RM per exercise, and one action for what comes next: continue with the
   next block of a longer program, repeat, or change the plan.

### 1.3 Bia — strength on the main lifts, hypertrophy on the rest (hybrid)

1. Keeps her v3 plan. In the editor, on workout A she taps **"Add program block"** → 5/3/1 (custom)
   → Back Squat; her accessories stay below it with double progression.
2. On another exercise she switches **Progression** from "Automatic" to **"Percent of 1RM"** and
   types her coach's waves: week 1 `4×6 @70%`, week 2 `4×5 @75%`, week 3 `4×4 @80%`.
3. Or she asks an AI chatbot for the whole plan: the prompt (README) now explains percent schemes,
   and the import preview shows them and the 1RMs they need.
4. A missing 1RM never blocks her: the exercise shows "Set the 1RM to get loads" with a one-tap
   dialog, in the plan and in the logger.

### 1.4 Coming back from v1

A device that still holds v1 data gets its reference 1RMs copied to the new model (§11.1) and its
focus set to strength, so the Strength tab and the 1RMs screen are populated on first launch.

---

## 2. Reference 1RM (`src/domain/reference-max.ts`, pure)

```ts
type ReferenceMaxOrigin = 'manual' | 'fromE1rm' | 'onboarding' | 'import' | 'v1';
interface ReferenceMax {
  id: number; profileId: number;
  exerciseId: string;          // any built-in or custom exercise
  kg: number;                  // > 0, ≤ 1000, at most 2 decimals
  effectiveAt: string;         // ISO 8601 timestamp
  origin: ReferenceMaxOrigin;
}
```

- A change **adds a record**; nothing is overwritten. The current value of an exercise is the record
  with the latest `effectiveAt` (ties: greatest `id`). A record can be deleted (to undo a mistake);
  deleting the only record leaves the exercise without a reference 1RM.
- `currentMax(records, exerciseId)`, `maxAt(records, exerciseId, iso)` (the value in effect at a
  moment; `null` before the first record), `maxHistory(records, exerciseId)` (newest first),
  `validateMaxKg(kg)` → `'required' | 'outOfRange' | 'tooManyDecimals' | null`.
- `floorToHalfKg(kg)`: the value offered by "Use as new 1RM" — the estimate rounded **down** to
  0.5 kg (107.667 → 107.5; 96 → 96).

## 3. e1RM formulas and effort scale

### 3.1 Formulas (`src/domain/e1rm.ts`, `src/domain/rts-table.ts`, pure)

`n = reps + rir`; a missing RIR counts as 0 (v2 rule). Results are rounded to 3 decimals.

| id | Formula | Source |
|---|---|---|
| `epley` (**default**, unchanged from v2) | `w × (1 + n/30)`; `n = 1` → `w` | Epley (1985), RIR added to the reps |
| `brzycki` | `w × 36 / (37 − n)`; `n = 1` → `w`; `n ≥ 37` → no estimate | Brzycki (1993), RIR added to the reps |
| `rts` | `w / pct(reps, RPE)`, RPE = 10 − RIR, chart of reps 1–12 × RPE 6–10 with half points | M. Tuchscherer, Reactive Training Systems; chart restored from v1 `src/domain/e1rm/rts-table.ts` with its `source` |

- `estimate1rm(weightKg, reps, rir, formula)` → `{ kg, confidence: 'normal' | 'low' } | null`
  (`null` for a zero weight or an undefined formula value).
- **Confidence** (v1 §8.2): `normal` when `rir ≤ 4` and `n ≤ 12`; otherwise `low`.
- `rts` outside its chart (reps > 12 or RPE < 6) falls back to `epley` with `low` confidence, so
  charts of high-rep exercises have no holes.
- Examples (tests use them): 80 kg × 5 @ RIR 1 → `epley` 80 × 36/30 = **96.0**; `brzycki`
  80 × 36/31 = **92.903**; `rts` 80 / pct(5, RPE 9) with the chart's exact value. 60 × 15 @ RIR 0 →
  `epley` 90.0 `low`; `rts` → 90.0 `low` (fallback). 100 × 1 @ RIR 0 → 100.0 in every formula.
- The formula is a profile setting (§10.6). History is never rewritten: every chart, record and card
  is computed from the logbook with the formula selected now.

### 3.2 Which estimate is shown where

- Progress charts, personal records and new-record detection keep the v2 selection (best estimate
  among the counted sets of the session), computed with the selected formula.
- **Strength estimates** — session summary line, Strength tab, "Use as new 1RM", cycle-report 1RM
  suggestion — use `normal`-confidence sets only: `strengthE1rm(sets, formula)` = the best `normal`
  estimate among the counted sets, or `null`. A session of 15-rep sets has no strength estimate.

### 3.3 Effort scale (`src/domain/effort.ts`, pure)

- `LoggedSet.rir` accepts 0–10 in steps of **0.5** (was integer). Plan targets (`targetRir`, ramp)
  stay integers.
- Setting `effortScale: 'rir' | 'rpe'` (default `rir`). `rpeFromRir(rir) = 10 − rir`,
  `rirFromRpe(rpe) = 10 − rpe`. In RPE mode every effort input, label, target and summary shows RPE
  (set input: 0–10 in steps of 0.5; a plan target RIR 2 reads "RPE 8"); storage is always RIR.
- Progression rules (SPEC §6, SPEC-v3 §5) compare numbers and are unchanged by half points.

## 4. Programs (`src/domain/program.ts` pure types and functions; data in `src/library/programs/`)

### 4.1 Rules (from v1 §3.1, still non-negotiable)

1. Never invent sets, reps or percentages. The numeric data is the v1 transcription
   (`git show 3774916:src/programs/data/<file>`), moved without changing a number; a data test pins
   every template to a snapshot taken from the v1 files.
2. Every template keeps `source` (author, reference, URL, access date, notes), `version` and
   `verification: 'verified' | 'partial' | 'unverified'`; unverified prescriptions keep
   `unverified: true` and their note. The UI shows an "Unverified data" badge and calculates no load
   for a set without a confirmed percentage.
3. Programs are stored in full; nothing is compressed to fit a cycle.
4. Program text is language-neutral data with `{ en, 'pt-BR'? }` labels.

### 4.2 Schema

```ts
interface ProgramRole {
  id: string;                    // template-local: 'lift', 'squat', 'bench', 'deadlift'
  label: LocalizedText;
  defaultExerciseId?: string;    // offered first in the wizard
  /** True when the original is written for this exercise only (shown as a fidelity note when the user maps another). */
  fixedInOriginal?: boolean;
}
interface ProgramTemplate {
  id: string;                    // 'cycle-531-custom', 'smolov-jr', 'smolov', 'sheiko-29' …
  family: '531-custom' | 'smolov-jr' | 'smolov' | 'sheiko';
  name: string; variant?: string; version: string;
  source: ProgramSource; verification: Verification;
  durationWeeks: number; daysPerWeek: number;
  roles: ProgramRole[];
  configurable?: ConfigurableParam[];   // v1 type: id, label, unit 'fraction' | 'kg', min, max, step?, default, source
  weeks: ProgramWeek[];                 // { week, phase?, days: { day, label?, items }[] }
}
type ProgramItem =
  | { kind: 'main'; role: string;
      /** Variation performed instead of the role's exercise; percentages still refer to the role's 1RM. */
      variation?: { exerciseId: string; name: LocalizedText };
      sets: ProgramSet[]; note?: LocalizedText }
  | { kind: 'accessory'; exerciseId: string; name: LocalizedText; sets: number; reps: number; note?: LocalizedText }
  | { kind: 'info'; role?: string; text: LocalizedText; unverified?: boolean; note?: LocalizedText };
interface ProgramSet {            // v1 SetPrescription
  reps: number;
  percent?: number;               // fraction of the 1RM (0.75); absent → no load
  percentParam?: string;
  addKg?: { param: string; times?: number } | { kg: number };
  amrap?: boolean; repeat?: number; unverified?: boolean; note?: LocalizedText;
}
```

- **Roles replace lifts.** Mapping from v1: `lift: 'selected'` → role `lift` (no default exercise);
  `bench` / `squat` / `deadlift` → roles of the same name with defaults `barbell-bench-press`,
  `barbell-back-squat`, `conventional-deadlift`. Smolov's role `squat` has `fixedInOriginal: true`.
  `allowedLifts` / `liftSelectable` are dropped: any role maps to any exercise.
- **Variations** (Sheiko: deadlift up to knees, deadlift from boxes, deficit deadlift, front squat …)
  and **accessories** (dumbbell fly, good morning, dip, lunge, abs, push-up, press, French press,
  triceps, leg press, back extension …) reference library exercises. The stage adds the missing
  exercises to the library (bilingual names, muscles, equipment per SPEC §2.2) and records in
  `docs/DECISIONS.md` every mapping where the original names a generic movement ("Abs", "Triceps",
  "Press") and the app picks a concrete exercise; the original name stays as the item's `name` and is
  what the UI shows next to the exercise.
- Templates restored: `cycle-531-custom`, `smolov-jr`, `smolov`, `sheiko-29`, `sheiko-30`,
  `sheiko-31`, `sheiko-32`, `sheiko-37` (the v1 set), registry `PROGRAMS` in display order,
  `findProgram(id)`.
- Data tests: schema validity for every template (`validateProgram`), every referenced exercise
  exists, every role of a main item is declared, the snapshot of rule 1, and the v1 sanity values
  (Smolov Jr. week 1: 6×6 @70 %, 7×5 @75 %, 8×4 @80 %, 10×3 @85 %; custom 5/3/1: 3×5 @75 %,
  3×3 @85 %, 3×1 @95 %).

### 4.3 Functions

- `validateProgram(template, exerciseExists)` → issues (codes).
- `resolveParams(template, params)` → values with defaults; `validateParams` → `unknownParam`,
  `paramOutOfRange`, `paramOffStep`.
- `programWeekFor(startWeek, cycleWeek, durationWeeks)` =
  `((startWeek − 1 + cycleWeek − 1) mod durationWeeks) + 1`. Examples: (1, 1, 3) → 1; (1, 4, 3) → 1;
  (4, 2, 13) → 5; (12, 3, 13) → 1.
- `expandProgramDay(template, link, programWeek)` → `GeneratedItem[]` in the original order:
  - main item of a mapped role → `{ kind: 'main', exerciseId: variation?.exerciseId ?? roles[role],
    basisExerciseId: roles[role], label: variation?.name, sets: SchemeSet[], note, unverified }` with
    parameters applied (`percentParam`, `addKg` param × times, fixed kg) and the fraction converted
    to percent (0.75 → 75);
  - main item of an unmapped role → skipped;
  - accessory (when `link.accessories`) → `{ kind: 'accessory', exerciseId, label: name, sets, reps }`;
  - info with a mapped role → `{ kind: 'free', exerciseId: roles[role], note: text, unverified }`
    (an exercise with no prescribed sets: a max test, a loosely described phase);
  - info without a role → `{ kind: 'note', text }`.
  A day with no `main`, `accessory` or `free` item is a **rest day**.
- `fidelityWarnings(plan, programs)` (v1 §1.1): per `(programId, mapped exercise)` used in the plan,
  `{ code: 'incompleteFrequency', programId, daysPerWeek, daysUsed }` when the plan's blocks cover
  fewer distinct days than the program prescribes; `{ code: 'notOriginalExercise', programId, role }`
  when a `fixedInOriginal` role maps to another exercise. Warnings never block.

## 5. Plan model (`src/domain/plan.ts`, `src/domain/percent-scheme.ts`)

### 5.1 Percent scheme on a plan exercise

```ts
interface SchemeSet {
  reps: number;          // integer 1–100
  percent?: number;      // percent of the reference 1RM: 1–120, steps of 0.5; absent → no load
  addKg?: number;        // kg added after the percentage: −100 … 100, at most 2 decimals; default 0
  repeat?: number;       // identical sets, integer 1–20; default 1
  amrap?: boolean;       // "as many reps as possible": `reps` is the minimum
  unverified?: boolean;
}
interface SchemeWeek { sets: SchemeSet[] }            // 0–20 groups, at most 40 sets after `repeat`
interface PercentProgression {
  weeks: SchemeWeek[];          // 1–16
  startWeek?: number;           // integer 1…weeks.length, default 1: the scheme week of cycle week 1
  basisExerciseId?: string;     // exercise whose 1RM the percentages refer to; default: the exercise itself
}
interface PlanExercise { /* v2/v3 fields */ percent?: PercentProgression }
```

- `percent` absent → automatic progression (v2), unchanged.
- With `percent`: `targetRir` and `startLoadKg` must be absent (`notAllowedWithPercent`);
  `restSeconds`, `note`, `supersetGroup` work as before. `sets`, `repMin`, `repMax` stay in the type
  and hold a **summary** written by `withPercentSummary(exercise)` — total sets, lowest and highest
  reps of the first non-empty scheme week — so lists show "5 × 3–5". The editor, the importer and the
  store call it before saving; nothing calculates from the summary.
- The scheme week of a cycle week is `programWeekFor(startWeek ?? 1, cycleWeek, weeks.length)`: a
  scheme shorter than the cycle repeats. A week with `sets: []` means the exercise is not trained
  that week and is left out of the workout.
- Validation codes (paths like `workouts[0].exercises[1].percent.weeks[2].sets[0].percent`):
  `required`, `tooFew`, `tooMany`, `outOfRange`, `notInteger`, `invalidStep`, `tooManyDecimals`,
  `unknownExercise` (basis), `notAllowedWithPercent`, `emptyScheme` (every week empty).

### 5.2 Program blocks on a plan workout

```ts
interface ProgramLink {
  id: string;                       // unique in the plan, same id space as plan exercises
  programId: string;
  day: number;                      // 1…daysPerWeek
  startWeek: number;                // 1…durationWeeks: the program week of cycle week 1
  roles: Record<string, string>;    // role id → exercise id; at least one
  accessories: boolean;
  params?: Record<string, number>;
}
interface PlanWorkout { /* v2 fields */ programs?: ProgramLink[] }   // 0–4
```

- A workout is made of its program blocks (generated each week, in order) followed by its own
  `exercises`. A workout needs at least one exercise **or** one program block (`exercises` may be
  empty when `programs` is not).
- Validation codes: `unknownProgram`, `outOfRange` (day, startWeek), `unknownRole`, `noRoleMapped`,
  `unknownExercise`, `unknownParam`, `paramOutOfRange`, `paramOffStep`, `tooMany`, `duplicateId`.
- **`expandWorkout(workout, ctx)`** → `EffectiveExercise[]`, the list every consumer uses instead of
  `workout.exercises` when it needs what is actually trained in a given week:
  `ctx = { phase, cycleWeek, programs, exerciseEquipment }`. Generated items become plan-exercise
  shaped entries with stable synthetic ids `"<linkId>:<itemIndex>"`:
  - `main` → `percent: { weeks: [{ sets }], basisExerciseId }` (one-week scheme of that program week);
  - `accessory` → automatic progression with `sets`, `repMin = repMax = reps`;
  - `free` → an exercise with one empty set and no target;
  - `note` texts are collected in `EffectiveWorkout.notes`.
  Own exercises follow, minus percent exercises whose scheme week is empty. `isRestDay` is true when
  the result has no exercise.
- `programToPlan(template, { name, roles, params, accessories })` → `PlanContent`: one workout per
  program day (name: the day label, else "Day N"), each with one block (`day`, `startWeek: 1`),
  `sessionsPerWeek = daysPerWeek`, cycle `{ loadWeeks: min(durationWeeks, 16), deloadWeeks: 0 }` with
  the default factors and no RIR ramp.
- `advanceProgramBlocks(content, programs)` → content where every block's `startWeek` moves forward by
  `cycle.loadWeeks` (wrapping with `programWeekFor`), and `hasNextBlock(content, programs)` = some
  block has `startWeek + loadWeeks ≤ durationWeeks`.

## 6. Prescriptions (`src/domain/prescription.ts`, pure)

### 6.1 Calculation

```ts
interface PrescribedSet {
  reps: number; amrap: boolean; unverified: boolean;
  percent: number | null; addKg: number;
  exactKg: number | null;      // 3 decimals
  kg: number | null;           // rounded to the exercise's increment
}
interface Prescription {
  basisExerciseId: string; basisKg: number | null;    // the reference 1RM used
  sets: PrescribedSet[];                               // `repeat` flattened, original order
  source: { kind: 'program'; programId: string; programWeek: number; day: number; label?: LocalizedText }
        | { kind: 'scheme'; schemeWeek: number };
  phase: Phase;
  warnings: ('missingReferenceMax' | 'noPercent' | 'unverified')[];
}
```

- `exactKg = basisKg × percent / 100 + addKg`, in integer milligram arithmetic, rounded half up to
  the gram, never below 0; `null` when the 1RM or the percent is missing.
- `kg = roundLoad(exactKg, increment, roundingMode)` with the increment of the **performed** exercise
  (SPEC §2.1) and the profile's rounding mode (§6.2).
- Tonnage of a prescription = `Σ reps × kg` over the sets with a load; total reps = `Σ reps`.
- Examples (tests use them; increment 2.5, mode `nearest`):
  - 1RM 100, 75 % → exact 75.000 → **75.0**.
  - 1RM 102.5, 72.5 % → 74.3125 → exact 74.313 → **75.0**.
  - 1RM 105, 75 % → 78.750, a tie between 77.5 and 80 → **77.5** (`up` → 80.0, `down` → 77.5).
  - Smolov Jr., 1RM 100, increment parameter 2.5 kg, day 1: week 1 `6×6 @70 %` → 70.0, tonnage
    6 × 6 × 70 = 2 520 kg; week 2 → 70 + 2.5 = **72.5**; week 3 → 70 + 5 = **75.0**.
  - Custom 5/3/1, 1RM 140: week 1 `3×5 @75 %` → 105.0; week 2 `3×3 @85 %` → 119.0 → **120.0**;
    week 3 `3×1 @95 %` → 133.0 → **132.5**.
  - No reference 1RM → `kg: null` for every set and the warning `missingReferenceMax`.

### 6.2 Rounding mode

Setting `roundingMode: 'nearest' | 'down' | 'up'` (default `nearest`, ties down: a load is never
prescribed above its percentage because of a tie). It applies to percent prescriptions only;
automatic progression is unchanged. The UI shows exact → rounded when they differ
(`74.31 → 75 kg`).

### 6.3 Deload weeks

For a plan with deload weeks, a percent exercise or program block in the deload phase takes the
prescription of **cycle week 1** and transforms it: every group keeps `deloadSets(repeat, volumeFactor)`
sets, each load is `exactKg × deloadLoadFactor` rounded as above, AMRAP is switched off. Generated
accessories follow the v2 deload rule. Example: custom 5/3/1, 1RM 140, factors 0.5 / 0.9 → week 1 is
`3×5 @ 105` → deload `2×5 @ 94.5 →` **95.0**.

### 6.4 Prescribed vs actual

`compareToPrescription(prescription, sets)` pairs the prescribed sets with the logged `working` sets
in order: per pair `deltaKg`, `deltaReps` (only for done sets); prescribed sets without a done
counterpart are `missed`; done working sets beyond the prescription are `extra`. Session level:
prescribed tonnage, actual tonnage (done working sets), delta. Example: prescribed 3×5 @ 105
(1 575 kg); logged 105×5, 105×5, 105×4 → deltas 0/0/−1 rep, actual 1 470 kg, delta −105 kg.

## 7. Logging a prescription

- `WorkoutExercise.prescription?: Prescription | null` — snapshot taken when the workout starts
  (history is immune to later changes of 1RM, parameters or program data). `target` holds the summary
  (total sets, lowest and highest reps, rest).
- The builder creates one `working` set per prescribed set with `weightKg = kg` and `reps = null`.
  **Ticking a prescribed set with empty reps stores the prescribed reps**; an AMRAP set needs the
  reps typed (placeholder "5+"). Weight and reps stay editable; sets can be added (they are `extra`)
  or removed.
- The exercise card shows the block's origin ("Smolov Jr. · week 2 · day 1", or "Percent of 1RM ·
  week 2"), the 1RM used, and each set's `% → kg` (exact → rounded when different); a variation shows
  its original name; unverified sets carry the badge and no load.
- Missing 1RM: the card shows "Set the 1RM to get loads" → dialog (kg, or estimate from a set) →
  saved as a reference 1RM (`manual`) and the not-yet-done sets of the active workout get their loads.
- After a done set with a strength estimate (§3.2) on an exercise that has a reference 1RM or a
  prescription, the row shows `e1RM ≈ 96 kg`; a `low`-confidence estimate is not shown.
- Rest day (§5.2): Home and the Workout tab show the program's note and **"Mark rest day as done"**,
  which advances the cycle like a completed session without creating a logbook entry.
- Summary (v2 §7.4) adds, per exercise with a reference 1RM: session e1RM, delta to the previous
  strength estimate (kg and %), prescribed vs actual tonnage when there was a prescription, and
  **"Use as new 1RM (107.5 kg)"** when `floorToHalfKg(estimate)` is above the current reference —
  explicit confirmation, origin `fromE1rm`, never automatic.
- History detail shows prescribed vs actual per set for exercises with a prescription.

## 8. Strength dashboard (`src/domain/strength.ts`, pure)

Input: the strength estimates of an exercise per session (date, kg, workout id) and its reference
records. Output per exercise with a reference 1RM:

- current reference (kg, date, origin); latest, previous and best estimate with dates;
- `delta = latest − previous` (kg, % of previous);
- improvement over the selected period (`4w`, `3m`, `6m`, `1y`, `all`; v2 `period.ts`):
  `latest − baseline` (kg, % of baseline), baseline = the reference in effect at the start of the
  period, or the first record when the period starts before it;
- chart series: estimates as points, reference records as a step line.

Example (tests use it, `epley`): references 100 kg (2026-01-05) and 105 kg (2026-03-02); sessions
2026-01-12 `85×5 @1` → 102.0; 2026-02-09 `90×4 @1` → 105.0; 2026-03-09 `95×3 @1` → 107.667.
Latest 107.667, previous 105.0 (delta +2.667 kg, +2.54 %), best 107.667; period `all`: baseline 100 →
+7.667 kg (+7.67 %); "Use as new 1RM" offers 107.5.

## 9. Import, export, AI

### 9.1 JSON (`cycle-plan` version 1, additive; normative text in `docs/IMPORT_FORMAT.md`)

```jsonc
{
  "format": "cycle-plan", "version": 1, "name": "Strength base",
  "referenceMaxes": [ { "exercise": "barbell-back-squat", "kg": 140 } ],          // optional
  "workouts": [
    { "name": "A",
      "programs": [                                                                // optional, 0–4
        { "program": "smolov-jr", "day": 1, "startWeek": 1,
          "roles": { "lift": "barbell-bench-press" }, "accessories": true,
          "params": { "weeklyIncrementKg": 2.5 } } ],
      "exercises": [                                                               // may be empty when programs is not
        { "exercise": "barbell-back-squat",
          "percent": { "of": "barbell-back-squat", "startWeek": 1,
            "weeks": [ [ { "sets": 3, "reps": 5, "percent": 75 } ],
                       [ { "sets": 3, "reps": 3, "percent": 85 } ],
                       [ { "sets": 2, "reps": 1, "percent": 95 }, { "sets": 1, "reps": 1, "percent": 95, "amrap": true } ] ] },
          "rest": 240 },
        { "exercise": "leg-curl", "sets": 3, "reps": "10-15", "rir": 2 } ] } ]
}
```

- With `percent`, the exercise-level `sets` / `reps` are not required and are ignored; `rir` and
  `startLoad` are rejected (`notAllowedWithPercent`). In a week array, a group's `sets` is the
  `repeat` count (default 1); `[]` is a week without the exercise.
- `programs[].program` is a program id (§4); unknown id → `unknownProgram`.
- `referenceMaxes`: at most 50; `exercise` resolves like any exercise reference (IMPORT_FORMAT §3).
  On import a value is saved (origin `import`) **only for an exercise without a reference 1RM**; the
  preview lists what will be set and what is kept.
- Export writes all of it back; export → import is lossless (round-trip test).
- A file with these properties needs CYCLE 4.0 or later (older versions reject the exercise for its
  missing `sets`); the document says so.

### 9.2 Text format

One exercise line may carry a percent scheme: groups separated by `,`, weeks by `/`, `+` after the
reps for AMRAP:

```
Back Squat 3x5 @75% / 3x3 @85% / 2x1 @95%, 1x1+ @95%
Bench Press 5x5 @80%
```

A single week repeats every week. `@NN%` on any group makes the line a percent scheme; mixing groups
with and without `%` is an error (`mixedPercent`).

### 9.3 AI prompts

- Plan prompt (`AI_PLAN_PROMPT_TEMPLATE`, both locales, mirrored in IMPORT_FORMAT §8): new rule —
  when the user asks for a strength, powerlifting or percentage-based program, prescribe the main
  lifts with `percent` schemes (weeks of sets × reps @ % of 1RM), keep accessories on rep ranges, and
  include `referenceMaxes` only with values the user gave; the OUTPUT block documents `percent`.
  Built-in program ids are not offered to the chatbot (it writes schemes, it does not cite programs).
- Review prompt (SPEC-v3 §7): the plan JSON carries the schemes; the summary adds one line per
  exercise with a reference 1RM (`1RM 140 kg · best e1RM in the cycle 143.5 kg`).

## 10. Screens

### 10.1 Onboarding

New first step **"What do you train for?"** — "General training" (muscle, health, fitness) /
"Strength" (powerlifting, percentage-based programs) → `settings.focus`. General continues as in v2.
Strength adds **"Your lifts"** (journey 1.2 step 1; saved with origin `onboarding`) and its last step
offers "Choose a strength program" (→ `/programs`) next to the v2 options. Profiles that already
completed onboarding skip it and keep `focus: 'general'` (v1 carry-over: §11.1).

### 10.2 Programs (`/programs`, `/programs/[id]`, `/programs/[id]/start`)

- List grouped by family: name, variant, duration, days per week, verification badge. Entry points:
  More, "New plan" (next to templates and import), onboarding.
- Detail: source block (author, reference, link, access date, notes), version, roles, parameters and
  the whole program week by week (sets × reps @ %, increments, accessories, info lines, unverified
  badges) — no loads.
- Start wizard: roles → exercises (exercise picker, defaults, fidelity note for `fixedInOriginal`),
  parameters (validated against min/max/step), accessories on/off, 1RMs of the mapped exercises
  (current value shown, editable; empty allowed), plan name → creates the plan with `programToPlan`,
  saves the 1RMs entered, activates the plan and opens its periodization table.

### 10.3 Plan editor and plan screen

- Workout card: **"Add program block"** (program → day → start week → roles → parameters →
  accessories); blocks are listed above the exercises with a summary line ("Smolov Jr. · day 1 →
  Bench Press"), can be edited, reordered among themselves and removed.
- Exercise row: **Progression** "Automatic" / "Percent of 1RM". The percent editor is a list of weeks,
  each a list of groups (sets × reps @ % [+ kg] [AMRAP]); "Copy previous week"; basis exercise
  (default: the exercise itself); start week.
- Plan screen: blocks and percent exercises show this week's prescription with loads; fidelity
  warnings; a missing-1RM notice with the dialog of §7; link to the periodization table.

### 10.4 Periodization table (`/plans/[id]/periodization`)

Columns = the cycle's weeks (load weeks, then deload weeks), rows = workouts with their effective
exercises. Percent cells: groups as `6×6 @70 % → 70 kg` (exact → rounded when different, "—" plus the
note when there is no load); automatic cells: `3 × 8–12 · RIR 2`; rest days are labeled. Footer per
week: tonnage and total reps of the percent work. The current week is highlighted. Narrow screens
show one week with a week selector; wide screens show all weeks, horizontally scrollable with the
first column pinned. It reads the same selector as the logger's builder, so both always agree (a test
changes a 1RM and asserts both).

### 10.5 1RMs and calculator (`/maxes`, `/maxes/[exerciseId]`, `/tools/one-rep-max`)

- **1RMs**: exercises with a reference 1RM (value, date, latest strength estimate and "Use" when
  higher), "Add exercise"; detail = history of records with origin, add (new record), delete one.
- **1RM calculator**: weight, reps, effort → the estimate under the three formulas with confidence,
  and a table of 50–100 % in steps of 5 % with the rounded load for a chosen increment; "Save as 1RM
  of…" (exercise picker).

### 10.6 Settings — "Strength" section

Focus (general / strength), e1RM formula, effort scale (RIR / RPE), rounding mode, link to 1RMs.

### 10.7 Progress, Home, cycle report, history

- Progress gains the **Strength** tab (§8); it is the first tab when focus is strength and is hidden
  while the profile has no reference 1RM and focus is general.
- Home: the next-workout card names the program week and day; a rest day shows its note and "Mark
  rest day as done"; a notice lists exercises of the active plan that miss a 1RM.
- Cycle report (SPEC-v3 §6) gains "Programs and 1RMs": per basis exercise the reference at the start
  and now, best strength estimate of the cycle and the suggested new 1RM (`floorToHalfKg`, offered
  when above the current one); per program block the weeks completed; actions "Continue with the next
  block" (when `hasNextBlock`; applies `advanceProgramBlocks`) and the existing ones.
- History detail: prescribed vs actual (§6.4).

## 11. Technical

### 11.1 Persistence

Migration `012`: table `reference_maxes`; settings `focus`, `e1rmFormula`, `effortScale`,
`roundingMode`; storage for `PlanExercise.percent`, `PlanWorkout.programs` and
`WorkoutExercise.prescription`; half-point RIR round trip. v1 carry-over: every row of the v1
reference-1RM history is copied to `reference_maxes` (origin `v1`, original date; `bench` →
`barbell-bench-press`, `squat` → `barbell-back-squat`, `deadlift` → `conventional-deadlift`), and a
profile that gets at least one such row has `focus` set to `strength`. Migrations 001–011 stay
immutable. `ReferenceMaxRepository` (list, add, delete) with contract tests on both implementations.

### 11.2 Backup and CSV

`cycle-backup` v1 gains optional `referenceMaxes` and the new settings; plans and workouts carry the
new fields. Restore remaps exercise ids of reference maxes, bases and role mappings. A v3 backup
restores unchanged. The CSV gains the columns `prescribed_weight_kg`, `prescribed_reps`, `percent`
(empty for sets without a prescription).

### 11.3 Architecture and quality

- New pure modules: `reference-max`, `e1rm`, `rts-table`, `effort`, `program`, `percent-scheme`,
  `prescription`, `strength` in `src/domain/`; `src/library/programs/` (data) and one hybrid plan
  template (custom 5/3/1 blocks on squat, bench press, deadlift and overhead press plus accessories on
  automatic progression) in `src/library/plan-templates/`.
- The store exposes: reference-max actions, the effective workout and prescriptions of any plan week
  (one memoized selector shared by the logger, the plan screen and the periodization table), rest-day
  completion, program-block advance, strength selectors.
- No new native modules.
- TDD, coverage thresholds, i18n parity and accessibility rules of AGENTS.md hold. New namespaces:
  `programs`, `strength`, `maxes`.
- App version `4.0.0`.

## 12. Acceptance flow (E2E, in-memory repositories, fake clock)

1. Fresh profile → onboarding with focus **Strength**: 1RMs Back Squat 140, Bench Press 100,
   Deadlift 180.
2. Reproduce the v1 example in one plan: workout 1 = block custom 5/3/1 → Bench Press; workout 2 =
   block Smolov Jr. day 2 → Bench Press (increment 2.5); workout 3 = block custom 5/3/1 → Back Squat;
   workout 4 = block Sheiko #29 day 2, role deadlift → Deadlift, accessories off. Cycle 3 load weeks,
   no deload. The plan screen shows the fidelity warning for Smolov Jr. (4 days/week, 1 used).
3. Periodization table: workout 1 weeks 1–3 = `3×5 @ 75`, `3×3 @ 85`, `3×1 @ 95`; workout 3 =
   `3×5 @ 105`, `3×3 @ 120`, `3×1 @ 132.5`; workout 2 week 1 = `7×5 @ 75`, week 2 = `7×5 @ 77.5`,
   week 3 = `7×5 @ 80`. Changing the Bench Press 1RM to 105 changes workout 1 week 1 to
   `3×5 @ 77.5` (78.75, tie down) in the table and in the next workout preview.
4. Start workout 1: three sets pre-filled; tick them without typing reps → 5 reps each; set RIR 1 on
   the last → the row shows the e1RM; finish → summary shows the session e1RM and prescribed vs
   actual.
5. Add a percent scheme to a plain exercise in the editor (two weeks), see it in the table; export
   the plan to JSON and import it back → identical content.
6. Program wizard: start Smolov Jr. for Back Squat → plan with 4 workouts, cycle 3 + 0; first
   workout prescribes `6×6 @ 97.5` (140 × 0.7 = 98.0 → 97.5).
7. A general-focus profile created in the same run never sees the Strength tab or 1RM prompts, and
   its v3 acceptance flow still passes.

## 13. Out of scope (v4.0)

- A three-lift total, Wilks/DOTS or meet-attempt planning (the lift axis stays out).
- Training max (a percentage of the 1RM as the basis), velocity-based training.
- Editing built-in programs; user-authored program templates beyond percent schemes on plan
  exercises.
- Units other than kilograms; cloud sync.
