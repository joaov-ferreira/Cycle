# CYCLE — Specification v3 ("gym companion")

> Extends [`SPEC.md`](./SPEC.md) (v2). Everything in the v2 spec stays valid unless this document
> says otherwise; section references such as "v2 §6.2" point to `SPEC.md`. The implementation plan is
> [`PLAN.md`](./PLAN.md). v2 is merged into `main` (PR #2).

- **Status:** v3.0 (approved for implementation)
- **Theme:** v2 made CYCLE a logbook that plans and suggests. v3 makes it the tool the user keeps
  open during the session, closes the loop with AI assistants, deepens the periodization and
  protects the data.
- **Priorities (in order):** nothing in v3 may slow down or complicate logging a set → data safety →
  in-gym tools → insight.

## 0. Feature summary

| # | Feature | Why it is useful |
|---|---|---|
| 1 | Rest timer with notification, keep-awake | The most used tool between sets; v2 stores `restSeconds` but does nothing with it |
| 2 | Plate calculator | No mental math to load a barbell |
| 3 | Warm-up set generator | A sensible ramp to the working load in one tap |
| 4 | Supersets and drop sets | Common in bodybuilding plans ("bi-set", "drop-set"); v2 can only describe them in notes |
| 5 | RIR ramp across the load weeks | Makes the load weeks a real mesocycle: effort rises week by week until the deload |
| 6 | End-of-cycle report and cycle history | Shows what the cycle achieved, exercise by exercise |
| 7 | "Review with AI" — training summary prompt and plan update in place | The AI that wrote the plan can now adjust it from real results |
| 8 | Backup / restore and CSV export | The app is local-only: losing the phone must not lose the logbook |
| 9 | Body weight and measurements | Bulk/cut tracking next to the training data |
| 10 | Training calendar, streak and weekly trends | Consistency and volume at a glance |
| 11 | Small aids: persistent exercise notes, similar-exercise suggestions, "how to" link, share summary, repeat a workout | Daily friction removers |

New glossary terms: **superset** (2–4 consecutive exercises performed back to back, resting only
after the last one), **drop set** (a set done right after a working set with a lighter load),
**RIR ramp** (target RIR that decreases linearly across the load weeks).

---

## 1. Rest timer

### 1.1 Logic (`src/domain/rest-timer.ts`, pure)

```ts
interface RestTimer { startedAt: number; endsAt: number }   // epoch milliseconds
startRest(nowMs, seconds): RestTimer
remainingSeconds(timer, nowMs): number      // max(0, ceil((endsAt − nowMs) / 1000))
adjustRest(timer, deltaSeconds, nowMs): RestTimer  // endsAt moves; never before nowMs
isRestOver(timer, nowMs): boolean
restSecondsFor(targetRestSeconds: number | undefined, defaultRestSeconds: number): number
```

- `restSecondsFor`: the plan exercise's `restSeconds` when defined (0 = no timer for that exercise),
  otherwise the profile's **default rest** (setting, 0–600 s in steps of 15, default 90; 0 = timers
  off for exercises without their own rest).
- Examples: `startRest(1_000, 90)` → `endsAt` 91 000; `remainingSeconds` at 31 500 → 60;
  `adjustRest(+15)` → `endsAt` 106 000; `adjustRest(−120)` at 31 500 → `endsAt` 31 500 (over).

### 1.2 Behavior

- Marking a set **done** (re)starts the timer with the rest of that exercise. Un-marking does not.
  In a superset (§4) only a set of the group's **last** exercise starts it.
- A bar pinned to the bottom of the logger shows the countdown (`1:30`), **−15 s**, **+15 s** and
  **Skip**. It never covers the set inputs.
- When the rest ends: two short vibration pulses; when the app is in the background, a local
  notification ("Rest over" + the next set: exercise name and set number). The notification is
  scheduled when the timer starts and rescheduled/cancelled on adjust, skip, finish or discard.
- Notification permission is requested the first time a timer starts. Denied → in-app countdown and
  vibration only, no further prompts. Settings has "Rest notifications" (on/off).
- The screen stays on while the logger shows a workout in progress (setting "Keep screen on",
  default on).
- The timer is derived from timestamps (no ticking state is stored); it is not persisted across an
  app restart.

---

## 2. Plate calculator (`src/domain/plates.ts`, pure)

```ts
platesPerSide(targetKg, barKg, availablePlatesKg): 
  | { status: 'ok'; plates: { kg: number; count: number }[]; achievedKg: number; remainderKg: number }
  | { status: 'belowBar' }
```

- Per side: `(targetKg − barKg) / 2`, filled greedily from the heaviest available plate down
  (unlimited count of each). `achievedKg = barKg + 2 × Σ plates`; `remainderKg = targetKg −
  achievedKg` (≥ 0, what cannot be loaded with the available plates). Exact arithmetic (grams).
- Settings (per profile): bar weight (20 default; 15, 10 or custom 0–50 kg, step 0.5) and the
  available plates (subset of 25, 20, 15, 10, 5, 2.5, 1.25, 0.5 kg; default all except 0.5). An
  exercise may override the bar weight (e.g. EZ bar).
- Shown for `barbell` exercises: a plates button next to the weight field opens "25 + 15 per side"
  (and the remainder, when not zero).

| Target / bar | Per side | Result |
|---|---|---|
| 100 / 20 | 40 | 25 + 15 |
| 62.5 / 20 | 21.25 | 20 + 1.25 |
| 142.5 / 20 | 61.25 | 2 × 25 + 10 + 1.25 |
| 43 / 20 | 11.5 | 10 + 1.25, achieved 42.5, remainder 0.5 |
| 20 / 20 | 0 | no plates |
| 15 / 20 | — | `belowBar` |

---

## 3. Warm-up set generator (`src/domain/warmup.ts`, pure)

`warmupSets(workLoadKg, incrementKg, minLoadKg = 0)` returns the ramp
`WARMUP_STEPS = [50 % × 8, 70 % × 5, 85 % × 2]` (app-defined, a starting point the user can edit):

- each load is rounded to the increment (nearest, ties down);
- a step is dropped when its load is ≤ 0, below `minLoadKg` (the bar weight for barbell exercises) or
  equal to the previous kept step's load;
- a work load of 0 gives no warm-up.

| Work load / increment / min | Warm-up sets |
|---|---|
| 100 / 2.5 / 20 | 50 × 8, 70 × 5, 85 × 2 |
| 42.5 / 2.5 / 20 | 20 × 8, 30 × 5, 35 × 2 |
| 30 / 2.5 / 20 | 20 × 5, 25 × 2 (15 kg is below the bar) |
| 12 / 1 / 0 | 6 × 8, 8 × 5, 10 × 2 |

**Add warm-up** on an exercise card inserts these sets (kind `warmup`, not done) before the working
sets, computed from the first working set's weight; warm-up sets that are not done are replaced.

---

## 4. Supersets and drop sets

### 4.1 Supersets

- `PlanExercise.supersetGroup?: string` (1–10 chars). **Consecutive** exercises of a workout with the
  same label form a superset of 2–4 exercises. Validation codes: `supersetNotAdjacent`,
  `supersetSize`. `WorkoutExercise.supersetGroup?: string | null` is the snapshot (optional in the
  type so workouts stored by v2 load unchanged).
- Import/export: JSON property `"superset": "A"` on an exercise (IMPORT_FORMAT.md, optional, no
  version change). Plain text: a line starting with `+` joins the previous exercise's superset:

  ```
  Supino reto com barra | 4x8-12
  + Crucifixo com halteres | 4x12-15
  ```
- Plan editor: "Link with next" / "Unlink" on an exercise.
- Logger: the group is one card labeled **Superset** (pt-BR: "Bi-set" for 2, "Tri-set" for 3,
  "Série gigante" for 4), sets shown round by round; the rest timer starts after the last
  exercise's set (§1.2).
- Progression, statistics and history treat each exercise independently.

### 4.2 Drop sets

- `LoggedSet.kind` gains `'drop'`. A drop set must come after a working or drop set of the same
  exercise (`dropWithoutWorkingSet`). Added in the logger with **+ Drop** on a working set (weight
  pre-filled with 80 % of that set, rounded to the increment, ties down).
- Drop sets count for **volume** only. Work load, progression, session score, e1RM, PRs, working-set
  counts and weekly sets per muscle ignore them (v2 §6.1 "counted sets" is unchanged).
- History and summaries show them marked as drop sets, indented under their working set.

---

## 5. RIR ramp (`src/domain/cycle.ts`)

- `CycleConfig.rirRamp?: { start: number; end: number } | null` — integers 0–5 with `start ≥ end`
  (`invalidRirRamp`). Off by default.
- `weekTargetRir(cycle, state)`: `undefined` without a ramp. In the load phase, with `N = loadWeeks`
  and `w = min(week, N)`: `N = 1` → `end`; otherwise `round(start − (start − end) × (w − 1) / (N − 1))`
  (half rounds up). In the deload phase → `start`.
- When a ramp is set, the week's value replaces every plan exercise's `targetRir` for workouts
  started in that week (stored in the workout's target snapshot, shown in the logger as "RIR 2 this
  week" and in the cycle timeline cells).
- `ExerciseSession` gains `targetRir?: number | null` (from the snapshot). The "easy" rule of v2 §6.2
  compares the logged RIR with the target **of that session**:
  `min(RIR) ≥ (last.targetRir ?? target.targetRir ?? 1) + 2`.
- Import/export: `cycle.rirRamp: { "start": 3, "end": 0 }`; plain-text directive `rir: 3-0`.
- Cycle settings: toggle "Increase effort each week" with start/end steppers.

| Ramp, load weeks | Week targets |
|---|---|
| 3 → 0, 4 weeks | 3, 2, 1, 0 |
| 3 → 0, 6 weeks | 3, 2, 2, 1, 1, 0 |
| 4 → 1, 3 weeks | 4, 3, 1 |
| 2 → 2, 5 weeks | 2, 2, 2, 2, 2 |

---

## 6. Cycle report and history (`src/domain/cycle-report.ts`, pure)

`cycleReport(plan, cycleNumber, workouts, exercises)` over the completed workouts of that plan and
cycle number:

```ts
interface CycleReport {
  planId: number; cycleNumber: number;
  startedAt: string | null; endedAt: string | null;       // first / last completion
  sessions: { done: number; planned: number };            // planned = (loadWeeks + deloadWeeks) × sessionsPerWeek
  adherence: number;                                       // min(1, done / planned), 3 decimals
  volumeKg: number;
  exercises: {
    exerciseId: string; sessions: number;                  // load-phase sessions only
    firstLoadKg: number | null; lastLoadKg: number | null; // work loads
    firstScore: number | null; lastScore: number | null;   // v2 §6.1 session score
    scoreChangePct: number | null;                         // (last − first) / first × 100, 1 decimal; null with < 2 sessions
    stalled: boolean; records: number;                     // PRs set during the cycle
  }[];                                                     // plan order
  muscleSetsPerWeek: Partial<Record<MuscleGroup, number>>; // load-phase working sets ÷ load weeks trained, 1 decimal
}
```

- Example: bench sessions scored 53.333 then 56.1 → change **+5.2 %**; 10 sessions done of 14 planned
  → adherence **0.714**.
- When a session completes a cycle (the state moves to the next cycle number), Home shows "Cycle N
  complete" with a link to the report. Plan detail lists the past cycles (those with at least one
  workout); each opens its report. Route: `plans/[id]/cycles/[cycle]`.
- The report screen shows adherence, total volume, a row per exercise (load first → last, change %,
  stall/PR markers) and the average weekly sets per muscle group, plus **Review with AI** (§7).

---

## 7. Review with AI

- `buildAiReviewPrompt({ plan, exercises, sessionsByExercise, report, locale })`
  (`src/library/ai-review-prompt.ts`, pure) returns a prompt made of: the coach role and task
  (analyze my results and return an adjusted plan); the current plan as `cycle-plan` JSON (v2 §4.4
  export); the training summary; a placeholder line where the user writes how they feel; and the
  OUTPUT / RULES / EXERCISE LIST blocks of the plan prompt (IMPORT_FORMAT.md §8), reused, not copied.
- Training summary (machine-friendly, the same in both locales except headings): adherence and
  sessions of the report; for each plan exercise its last 6 sessions, one line each —
  `2026-10-05: 40×12@2, 40×12@2, 40×11@1` (`weight×reps@RIR`, RIR omitted when not logged, `.` as
  decimal separator, ` (deload)` suffix for deload sessions, drop sets prefixed with `d`); the stalled
  exercises; the average weekly sets per muscle group.
- `buildAiReviewPrompt(input)` takes plain data, so it does not depend on the report module:

  ```ts
  interface AiReviewInput {
    locale: 'en' | 'pt-BR';
    planJson: string;                                   // v2 §4.4 export, pretty-printed
    notes?: string;                                     // empty → the localized placeholder below
    period: { from: string; to: string } | null;        // YYYY-MM-DD
    sessions: { done: number; planned: number } | null;
    exercises: {
      exerciseId: string; name: string; stalled: boolean;
      sessions: { date: string; deload: boolean;        // newest first, at most 6 are printed
        sets: { weightKg: number; reps: number; rir: number | null; drop?: boolean }[] }[];
    }[];
    muscleSetsPerWeek: { muscle: MuscleGroup; sets: number }[];
    exerciseList: readonly Exercise[];                   // for the EXERCISE LIST block
  }
  ```
- Prompt = the review header below (per locale) with `{{NOTES}}`, `{{PLAN}}` and `{{SUMMARY}}`
  replaced, then a blank line, then the plan prompt of IMPORT_FORMAT.md §8 **from its `OUTPUT` /
  `SAÍDA` line to the end** (output format, rules and the exercise list), unchanged.

  ````text
  You are an experienced strength and hypertrophy coach. Below are my current training plan in the
  CYCLE app and a summary of what I actually did. Review my results and give me an adjusted plan as a
  file for the CYCLE app.

  HOW TO REVIEW
  Look at each exercise: where the load or the reps went up, keep what works; where I stalled or fell
  below the rep range, change something (rep range, sets, exercise variation, order or rest). Check
  the weekly sets per muscle group and my adherence, and rebalance the volume if needed. Keep the
  exercises I am progressing on unless there is a reason to swap them. After the JSON, explain the
  main changes in a few lines. If my notes are empty and you need to know how I feel (pain, fatigue,
  schedule changes), ask me first and wait for my answer.

  MY NOTES
  {{NOTES}}

  CURRENT PLAN (cycle-plan JSON)
  {{PLAN}}

  TRAINING SUMMARY
  {{SUMMARY}}
  ````

  ````text
  Você é um treinador experiente de força e hipertrofia. Abaixo estão a minha periodização atual no
  app CYCLE e um resumo do que eu realmente fiz. Analise os meus resultados e me entregue uma
  periodização ajustada como um arquivo para o app CYCLE.

  COMO ANALISAR
  Olhe cada exercício: onde a carga ou as repetições subiram, mantenha o que funciona; onde estagnei
  ou fiquei abaixo da faixa de repetições, mude algo (faixa de repetições, séries, variação do
  exercício, ordem ou descanso). Confira as séries semanais por grupo muscular e a minha aderência e
  reequilibre o volume se for preciso. Mantenha os exercícios em que estou progredindo, a menos que
  haja motivo para trocar. Depois do JSON, explique as principais mudanças em poucas linhas. Se as
  minhas observações estiverem vazias e você precisar saber como me sinto (dor, fadiga, mudanças de
  agenda), pergunte primeiro e espere a minha resposta.

  MINHAS OBSERVAÇÕES
  {{NOTES}}

  PERIODIZAÇÃO ATUAL (JSON cycle-plan)
  {{PLAN}}

  RESUMO DOS TREINOS
  {{SUMMARY}}
  ````

  `{{NOTES}}` placeholder when empty: `(write here how you feel, pains, schedule changes)` /
  `(escreva aqui como você se sente, dores, mudanças de agenda)`.
- `{{SUMMARY}}` (headings localized, data lines identical in both locales):

  ```
  Period: 2026-10-01 to 2026-11-10
  Sessions done: 10 of 14 planned (adherence 71%)
  Set notation: weight×reps@RIR in kg; d = drop set.

  barbell-bench-press — Barbell Bench Press [stalled]
    2026-11-05: 40×12@2, 40×12@2, 40×11@1
    2026-10-29 (deload): 35×8, 35×8, d28×10

  Weekly sets per muscle group (average): chest 12, back 10.5
  ```

  Weights and set counts use `.` as decimal separator with no trailing zeros; adherence is a whole
  percent (`round(done / planned × 100)`); the period and sessions lines are omitted when their input
  is `null`; an exercise without sessions prints `  (no sessions)`; `[stalled]` only when stalled.
- Entry points: the cycle report and Plan detail → **Review with AI** → the prompt in a selectable
  field with *Share*, and the usage steps.
- **Updating a plan in place:** the import preview offers "Save as a new plan" or "Update
  *\<active plan\>*". Updating replaces the plan content and keeps its id, history links and cycle
  state (`nextWorkoutIndex` is clamped to the new number of workouts). The previous content is kept
  as an archived copy named "\<name\> (before update \<date\>)".

---

## 8. Backup, restore and export

### 8.1 Backup document (`src/domain/backup.ts`, pure; documented in `docs/BACKUP_FORMAT.md`)

```json
{ "format": "cycle-backup", "version": 1, "exportedAt": "2026-11-20T10:00:00.000Z", "appVersion": "3.0.0",
  "profile": { "name": "João" },
  "settings": { "language": "pt-BR", "theme": "dark", "experience": "intermediate", "…": "…" },
  "customExercises": [ … ], "exerciseSettings": [ … ],
  "plans": [ { "active": true, "content": { … }, "cycleState": { … }, "archivedAt": null, "…": "…" } ],
  "workouts": [ … ], "bodyMetrics": [ … ] }
```

- `buildBackup(data)` / `parseBackup(text)` with validation and error codes (`invalidJson`,
  `unsupportedFormat`, `unsupportedVersion`, `invalidBackup` + path). A round trip preserves every
  record.
- **Restore never overwrites:** it creates a **new profile** ("\<name\> (restored)", made unique) with
  everything in the file, remapping ids (custom exercise ids inside plans and workouts, plan ids
  inside workouts), then switches to it. The restore runs in one transaction; a failure leaves no
  partial profile.
- Settings → Data: **Export backup** (writes `cycle-backup-<profile>-<YYYYMMDD>.json` and opens the
  share sheet), **Restore backup** (document picker → summary of what the file contains →
  confirm), **Export logbook (CSV)**.
- `lastBackupAt` is stored; with at least one completed workout and no backup in the last 30 days,
  Settings and Home show a discreet reminder.

### 8.2 CSV (`logbookCsv(workouts, exercises)`)

One row per logged set of completed workouts, oldest first, RFC 4180 quoting, `.` decimal separator,
header: `date,workout,plan,phase,exercise_id,exercise,set,kind,weight_kg,reps,rir`
(`date` = completion timestamp, ISO 8601 UTC; `exercise` = English name; `set` = 1-based position
within the exercise).

---

## 9. Body tracking

- `BodyMetric { id, profileId, date /* YYYY-MM-DD */, kind, value }`, one value per day and kind
  (saving again replaces it). Kinds and limits: `weight` 20–400 kg; `bodyFat` 2–70 %; `waist`,
  `chest`, `hips`, `arm`, `thigh`, `calf` 10–300 cm; up to 2 decimals.
- `src/domain/body.ts`: validation (codes), `metricSeries(entries, kind, period)`, `metricStats`:
  latest value and date, change against the most recent entry at least 28 days older, and — for
  weight — the mean of the entries of the last 7 days.
  Example: weights 80.0 (day 1), 79.4 (day 20), 79.0 (day 29), 78.6 (day 30) → latest 78.6, change vs
  day 1 = **−1.4 kg**, 7-day mean = (79.0 + 78.6) / 2 = **78.8 kg**.
- More → **Body**: quick add (date defaults to today), list with edit/delete, chart per kind with the
  period filter, the stats above. Included in backups.

---

## 10. Calendar, streak and trends (`src/domain/insights.ts`, pure)

- `trainingDays(workouts, year, month)`: per local date, the number of completed workouts and whether
  any was a deload.
- `weekStreak(workouts, today)`: consecutive ISO weeks with at least one completed workout, counting
  back from the current week; a current week without a workout yet does not break the streak (the
  count starts at the previous week). Example: workouts in ISO weeks 40, 41, 42, 44 and today in week
  45 with none yet → streak **1** (week 44); a workout today → **2**.
- `weeklyTrends(workouts, exercises, weeks = 8, today)`: for each of the last 8 ISO weeks —
  sessions, volume (kg) and working sets per muscle group (v2 §9.3 rule).
- Progress tab: segmented control **Exercises** (v2) | **Volume** (bars per week: sessions, volume,
  sets of a selected muscle group) | **Calendar** (month grid, trained days marked, deload days in a
  different tone, month navigation, the streak and the month's workout count). Home shows the
  streak.

---

## 11. Small aids

- **Exercise note** (≤ 200 chars, per exercise and profile, e.g. "seat on position 4"): edited in the
  exercise detail and in the logger; shown under the exercise name every time it is logged.
- **Similar exercises** — `similarExercises(exercise, all, limit = 5)`: same primary muscle, not
  archived, ranked by same mechanics, then number of shared secondary muscles, then library order.
  Shown first in the picker when replacing an exercise (workout or plan).
- **How to** link in the exercise detail and the logger menu: opens a video search for the exercise
  name in the browser (the only place the app opens the network, and only on tap).
- **Share summary:** the workout summary as text (name, date, exercises with `weight × reps`, volume,
  PRs) through the share sheet.
- **Repeat workout:** from a history entry, start a free workout with the same exercises and set
  counts, weights pre-filled from that session.

---

## 12. Technical

- **Migration `011`:** table `body_metrics`; `exercise_settings.note`, `exercise_settings.bar_kg`;
  `workout_exercises.superset_group`; settings columns `default_rest_seconds`, `rest_notifications`,
  `keep_awake`, `bar_kg`, `plates` (JSON), `last_backup_at`. Migrations 001–010 are immutable.
  (v2's migration 010 must not restrict `workout_sets.kind` with a CHECK constraint, so `drop` needs
  no table rebuild.)
- Plan content and workout target snapshots are JSON: `supersetGroup` and `rirRamp` need no schema
  change. Plans saved by v2 load unchanged (both fields absent).
- New Expo modules (installed with `npx expo install` after reading the SDK docs; config plugins in
  `app.json`, no hand-edited native code): `expo-notifications`, `expo-keep-awake`, `expo-sharing`,
  `expo-file-system` (if v2 did not add it). The APK is built on the PR (label `build-apk`) before
  merging.
- Layering, TDD, coverage thresholds and i18n rules of v2 §11–§12 apply. New namespaces: `timer`,
  `tools`, `cycleReport`, `aiReview`, `backup`, `body`, `insights`.
- App version `3.0.0`.

## 13. Acceptance flow (E2E, in-memory repositories, fake clock)

1. Seed: a profile with the v2 acceptance plan (v2 §13) active, cycle `2+1`, default rest 90 s.
2. Edit the plan: link "Supino reto com barra" with the custom row as a superset; turn on the RIR
   ramp 2 → 0. Start workout A: one superset card; target line shows RIR 2.
3. Bench 40 kg: **Add warm-up** inserts **20 × 8, 27.5 × 5, 35 × 2** (50 % = 20; 70 % = 28 → 27.5;
   85 % = 34 → 35, increment 2.5 kg); the plates button on 40 kg shows **10 per side**.
4. Mark bench set 1 done → no timer (not the last exercise of the superset); mark the row's set 1
   done → the timer shows 1:30; advance the clock 90 s → "Rest over".
5. Add a drop set to bench set 3 (40 kg → pre-filled 32.5 kg), log 8 reps. Finish: the summary volume
   includes the drop set; working sets remain 6.
6. Complete the remaining sessions of the cycle → Home shows "Cycle 1 complete"; the report lists both
   exercises with their change and the adherence.
7. **Review with AI** shows a prompt containing the plan JSON, the bench sessions as
   `40×12, …` lines and the exercise list.
8. Log body weight 80.0 kg → More → Body shows it; Progress → Calendar marks today's date; the streak
   is 1.
9. Settings → Export backup → parse the produced document → Restore → a new profile "… (restored)"
   holds the same plan, workouts and body weight.

## 14. Out of scope (v3.0)

Cloud sync/accounts, training-day reminders, lb units, timed/cardio exercises, volume (set) ramps
across the cycle, per-set tempo, progress photos, wearables/widgets, social features, importing
other apps' formats, exercise videos or images bundled in the app.
