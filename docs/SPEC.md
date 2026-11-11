# CYCLE — Functional and Technical Specification (v2)

> General weight-training ("musculação") logbook with load/deload cycles and automatic load
> progression. This spec is the product's source of truth. The implementation plan lives in
> [`PLAN.md`](./PLAN.md) and the development rules in [`../AGENTS.md`](../AGENTS.md).
> The v1 powerlifting spec is archived in [`archive/SPEC-v1.md`](./archive/SPEC-v1.md).

- **Status:** v2.0 (approved for implementation)
- **Platform:** Expo SDK 58 / React Native 0.88 / Expo Router (Android first; iOS and Web supported)
- **Audience:** anyone doing resistance training, from beginners to advanced lifters
- **Languages:** project (code, docs, commits, PRs) in English; app UI bilingual — English (`en`)
  and Brazilian Portuguese (`pt-BR`). See §12.1.
- **Priorities (in order):** a fast, reliable logbook → correct and explainable suggestions
  (progression, deload) → flexible plans (import, templates, custom exercises) → progress insight

---

## 0. Glossary

| Term | Definition |
|---|---|
| **Exercise** | A movement in the library (built-in) or created by the user (custom). |
| **Plan** ("Periodização" in pt-BR UI) | A named training plan: an ordered list of workouts plus a cycle configuration. |
| **Plan workout** | One training day of a plan (e.g. "A — Chest and triceps"): an ordered list of plan exercises. |
| **Plan exercise** | An exercise inside a plan workout with its target: sets × rep range, optional target RIR, rest. |
| **Training week** | `sessionsPerWeek` completed plan sessions (training-driven, not calendar-driven). |
| **Cycle** | `loadWeeks` training weeks of normal training followed by `deloadWeeks` weeks of reduced training. |
| **Phase** | `load` or `deload`. |
| **Workout** | A logged training session (the logbook entry): exercises with their sets. |
| **Working set / warm-up set** | Only working sets count for volume, progression, PRs and statistics. |
| **Work load** | The weight used by most working sets of an exercise in a session (§6.1). |
| **RIR** | Reps in reserve (optional, integer 0–10). |
| **e1RM** | Estimated one-rep max of a set (Epley, §6.1). Always shown as an estimate. |

---

## 1. Product overview

CYCLE v2 turns the v1 powerlifting periodization app into a general weight-training app:

1. **Exercise library** — a broad list of pre-configured exercises (≥ 150, bilingual), searchable and
   filterable, plus custom exercises created by the user (§2).
2. **Plans** — the user gets a plan by importing it (JSON or plain text, pasted or from a file), by
   picking a built-in template, or by building it in the editor (§3, §4).
3. **Load/deload cycles** — every plan has a cycle (N load weeks + deload weeks). The app suggests a
   cycle for the user's experience level, tracks the position in the cycle, announces and prescribes
   the deload, and suggests an early deload when progress stalls (§5).
4. **Logbook** — each session is logged set by set: weight, reps, optional RIR (§7).
5. **Automatic load progression** — for every plan exercise the app suggests the next load and rep
   targets from the user's history, and explains why (§6).
6. **History and progress** — past workouts, per-exercise charts, personal records and weekly volume
   per muscle group (§8, §9).

What is removed from v1: the three powerlifting lifts model, reference 1RMs and their onboarding, the
program database (custom 5/3/1, Smolov, Smolov Jr., Sheiko), the three-week periodization generator,
the RTS/Brzycki e1RM formulas and the stored e1RM history. v1 data already on a device is preserved
(§11.3). The v1 code remains available in git history (last v1 commit: `3774916`).

---

## 2. Exercise library

### 2.1 Model (`src/domain/exercise.ts`)

```ts
type LocalizedText = { en: string; 'pt-BR': string };

const MUSCLE_GROUPS = ['chest', 'back', 'shoulders', 'traps', 'biceps', 'triceps', 'forearms',
  'abs', 'lowerBack', 'glutes', 'quads', 'hamstrings', 'adductors', 'abductors', 'calves'] as const;
type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'smith', 'kettlebell',
  'bodyweight', 'band', 'other'] as const;
type Equipment = (typeof EQUIPMENT)[number];

type Mechanics = 'compound' | 'isolation';

interface Exercise {
  id: string;                    // built-in: kebab-case slug; custom: `custom-<n>` (n = database id)
  name: LocalizedText;           // custom exercises store the same text in both locales
  aliases: string[];             // extra names accepted by the import matcher (any language)
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[]; // never contains primaryMuscle, no duplicates
  equipment: Equipment;
  mechanics: Mechanics;
  custom: boolean;
  archived: boolean;             // custom only; archived exercises are hidden from pickers
}
```

- **Zero-load exercises:** `equipment` `bodyweight` and `band` accept a weight of `0` (the logged
  weight is the *added* load). Every other equipment requires weight > 0.
- **Default load increment per equipment** (`DEFAULT_INCREMENT_KG`): barbell 2.5, smith 2.5,
  dumbbell 1, kettlebell 4, machine 5, cable 5, bodyweight 2.5, band 1, other 2.5. The user may
  override the increment per exercise (0.25–25 kg, step 0.25); `incrementFor(exercise, override)`
  returns the override or the default.

### 2.2 Built-in library (`src/library/exercises/`)

- At least **150** exercises, in data files grouped by primary muscle, exposed through a registry
  (`listExercises()`, `findExercise(id)`).
- Coverage (enforced by data tests): every muscle group has ≥ 4 exercises as primary muscle, except
  `forearms`, `adductors`, `abductors` and `traps` (≥ 2); every equipment type except `other` has
  ≥ 5 exercises.
- These ids are part of the contract (used by templates, tests and the v1 data carry-over):
  `barbell-bench-press`, `barbell-back-squat`, `conventional-deadlift`, `overhead-press`,
  `barbell-row`, `pull-up`, `lat-pulldown`, `dumbbell-curl`, `triceps-pushdown`, `leg-press`,
  `leg-extension`, `leg-curl`, `romanian-deadlift`, `lateral-raise`, `standing-calf-raise`.
  Timed exercises (e.g. plank) are not included (out of scope, §15).
- Names use the terms actually used in gyms: English (e.g. "Barbell Bench Press") and Brazilian
  Portuguese (e.g. "Supino reto com barra", "Agachamento livre", "Levantamento terra", "Puxada alta",
  "Remada curvada", "Elevação lateral", "Rosca direta", "Tríceps na polia", "Cadeira extensora",
  "Mesa flexora", "Leg press 45°"). `aliases` hold common alternative names in both languages.
- Data tests: unique kebab-case ids; non-empty names in both locales; no two exercises share a
  normalized name or alias (§4.3 normalization) — otherwise import matching would be ambiguous;
  `secondaryMuscles` valid; coverage rules above.

### 2.3 Custom exercises

- Create (name 1–60 chars, primary muscle, equipment, mechanics, optional secondary muscles), edit,
  archive/unarchive. A custom exercise is never hard-deleted once it is referenced by a plan or a
  workout; an unreferenced one can be deleted.
- The name must not collide (normalized) with any built-in or other non-archived custom exercise of
  the profile (error code `duplicateName`).
- Custom exercises are scoped per profile.
- `validateCustomExercise(input: CustomExerciseInput, others)` returns error codes (`required`,
  `tooLong`, `duplicateName`, `invalidMuscle`, `invalidEquipment`, `invalidSecondaryMuscles`).

### 2.4 Exercises screen (More → Exercises)

Searchable list (matches name in the current locale, the other locale and aliases, normalized) with
filters by muscle group and equipment; custom exercises carry a badge. Detail view: names, muscles,
equipment, increment (editable override), recent history of the exercise (last sessions with sets),
PRs, link to its Progress chart; for custom exercises: edit and archive. "New exercise" action.

---

## 3. Plans

### 3.1 Model (`src/domain/plan.ts`)

```ts
interface PlanExercise {
  id: string;            // stable key inside the plan (unique per plan)
  exerciseId: string;
  sets: number;          // integer 1–20
  repMin: number;        // integer 1–100
  repMax: number;        // integer repMin–100
  targetRir?: number;    // integer 0–5
  restSeconds?: number;  // integer 0–900
  startLoadKg?: number;  // 0–1000 kg, ≤ 2 decimals; suggested load while the exercise has no history
                         // (0 only for zero-load equipment, §2.1)
  note?: string;         // ≤ 200 chars
}
interface PlanWorkout { id: string; name: string /* 1–40 chars */; exercises: PlanExercise[] /* 1–30 */ }
interface CycleConfig {
  loadWeeks: number;          // integer 1–16
  deloadWeeks: number;        // integer 0–2 (0 = no scheduled deload)
  deloadVolumeFactor: number; // 0.3–1.0, step 0.05 — fraction of the sets kept in a deload
  deloadLoadFactor: number;   // 0.5–1.0, step 0.05 — fraction of the work load used in a deload
}
interface PlanContent {
  name: string;               // 1–60 chars
  description: string;        // ≤ 500 chars
  workouts: PlanWorkout[];    // 1–14
  sessionsPerWeek: number;    // integer 1–14; default = workouts.length
  cycle: CycleConfig;
}
interface Plan extends PlanContent {
  id: number; profileId: number; createdAt: string; updatedAt: string; archivedAt: string | null;
  cycleState: CycleState;     // §5.2
}
```

`DEFAULT_CYCLE: CycleConfig = { loadWeeks: 6, deloadWeeks: 1, deloadVolumeFactor: 0.5, deloadLoadFactor: 0.9 }`.

`validatePlanContent(content, findExercise)` — `findExercise(id)` returns the exercise or
`undefined` — returns a list of issues `{ path: string; code: PlanIssueCode }` (never display
strings); an empty list means valid. Codes cover every rule above plus `unknownExercise`,
`duplicateId` and `zeroLoadNotAllowed` (`startLoadKg` 0 on equipment that requires a load).

### 3.2 Plan management (Plan tab)

- **Plans list:** all non-archived plans of the profile; one is **active** (used by Home and the
  Workout tab). Actions: activate, duplicate, rename, archive, export (§4.4), delete (confirmation;
  logged workouts stay in the history and keep their names).
- **Plan detail:** workouts with their exercises (`4 × 8–12`, RIR, rest), the cycle card (§5.5).
- **Plan editor:** edit name/description/sessions per week; add, rename, remove and reorder (↑/↓)
  workouts; add (exercise picker), edit targets, remove and reorder exercises. Validation errors are
  shown inline, localized; an invalid plan cannot be saved.
- **New plan:** three entry points — *From a template* (§3.3), *Import* (§4), *Start from scratch*.
- Editing a plan never changes logged workouts (a workout stores a snapshot of its targets).

### 3.3 Built-in plan templates (`src/library/plan-templates/`)

App-authored, generic starting points (not transcriptions of published programs). Each template is a
`PlanContent` with localized name, description and workout names, referencing built-in exercise ids:

| id | Workouts | `sessionsPerWeek` |
|---|---|---|
| `full-body-3x` | A, B (alternating full-body days) | 3 |
| `upper-lower-4x` | Upper A, Lower A, Upper B, Lower B | 4 |
| `push-pull-legs` | Push, Pull, Legs | 6 |
| `abc` | A chest+triceps, B back+biceps, C legs+shoulders | 3 |
| `abcd` | A chest+triceps, B back+biceps, C legs, D shoulders+abs | 4 |
| `abcde` | chest, back, legs, shoulders, arms | 5 |

Rules enforced by data tests: every template passes `validatePlanContent` against the built-in
library; each workout has 4–8 exercises; sets 2–5; rep ranges within 5–20; every template uses
`DEFAULT_CYCLE`; names/descriptions exist in both locales. Importing a template creates a normal,
fully editable plan with texts in the current UI language.

---

## 4. Plan import and export

### 4.1 JSON format (`cycle-plan`, version 1)

The normative data specification is [`IMPORT_FORMAT.md`](./IMPORT_FORMAT.md) (properties, limits,
defaults, error codes, versioning) with a JSON Schema in
[`cycle-plan.schema.json`](./cycle-plan.schema.json). Summary:

```json
{
  "format": "cycle-plan",
  "version": 1,
  "name": "Upper / Lower",
  "description": "optional",
  "sessionsPerWeek": 4,
  "cycle": { "loadWeeks": 5, "deloadWeeks": 1, "deloadVolumeFactor": 0.5, "deloadLoadFactor": 0.9 },
  "customExercises": [
    { "key": "my-machine-row", "name": "Hammer row", "primaryMuscle": "back",
      "secondaryMuscles": ["biceps"], "equipment": "machine", "mechanics": "compound" }
  ],
  "workouts": [
    { "name": "Upper A", "exercises": [
      { "exercise": "barbell-bench-press", "sets": 4, "repMin": 6, "repMax": 10, "rir": 2, "rest": 150, "startLoad": 60, "note": "" },
      { "exercise": "my-machine-row", "sets": 3, "reps": "8-12" },
      { "exercise": "Rosca direta", "sets": 3, "reps": 12 }
    ] }
  ]
}
```

- `exercise` is resolved, in this order: a `customExercises[].key` of the same document → a built-in
  id → a name/alias match (§4.3) against the built-in library and the profile's custom exercises.
- Rep target: either `repMin` + `repMax`, or `reps` as `"8-12"`, `"10"` or a number (then
  `repMin = repMax`).
- Optional fields and their defaults: `description` `""`, `sessionsPerWeek` = number of workouts,
  `cycle` = `DEFAULT_CYCLE` (each missing field individually defaulted), `customExercises` `[]`,
  `rir`/`rest`/`note` absent.
- `format` must be `"cycle-plan"` and `version` must be `1` (`unsupportedFormat`, `unsupportedVersion`).
- Unknown properties are ignored. Structural errors are reported as `{ path, code }` with the codes of
  IMPORT_FORMAT.md §5.
- **Chatbot answers are accepted as pasted:** the importer takes the first fenced code block
  (```` ```json ```` or ```` ``` ````) when there is one, otherwise the text from the first `{` to the
  last `}`.

### 4.2 Plain-text format

A format a person can type in a notes app:

```
# Upper / Lower
cycle: 5+1
sessions: 4

## Upper A
Supino reto com barra | 4x6-10 | rir 2 | rest 150
Remada curvada | 4x8-12
- Rosca direta | 3x12 | keep elbows still

## Lower A
Agachamento livre | 4x6-10
```

- `# <name>` — plan name (required, first non-blank line that is not a directive).
- Directives before the first workout, case-insensitive: `cycle: <load>+<deload>` (pt-BR alias
  `ciclo:`), `sessions: <n>` (alias `sessoes:` / `sessões:`). Any other text before the first `##`
  becomes the description.
- `## <name>` — starts a workout.
- Exercise line: optional bullet (`-`, `*` or `1.`), then fields separated by `|` or `;`:
  `<exercise name> | <sets>x<repMin>[-<repMax>] [| rir <n>] [| rest <seconds>] [| <note>]`.
  `x` may also be `×`; spaces around tokens are ignored; `rir`/`rest` are case-insensitive
  (pt-BR alias `descanso`). A field that is not `rir …`/`rest …` after the sets field is the note.
- Blank lines are ignored.
- Errors are reported with a 1-based line number and a code (`missingPlanName`, `exerciseOutsideWorkout`,
  `invalidExerciseLine`, `invalidDirective`, `emptyWorkout`, `noWorkouts`), never display strings.

### 4.3 Parsing, name matching and resolution (`src/domain/plan-import.ts`, `exercise-match.ts`)

- `detectFormat(text)`: JSON when the text contains a fenced code block whose content starts with
  `{`, or when the trimmed text starts with `{`, or when it contains `"format"` followed by
  `"cycle-plan"`; otherwise plain text. `extractJson(text)` implements the extraction rule of §4.1.
- `normalizeName(text)`: lowercase, strip diacritics, replace every run of non-alphanumeric characters
  with a single space, trim. (`"Supino Reto c/ Barra"` → `"supino reto c barra"`.)
- **Matching is exact on normalized text** against ids, both localized names and aliases. The matcher
  never guesses: an unmatched name is reported as **unresolved**, with up to 3 **suggestions** ranked
  by the number of shared normalized tokens (ties → library order; at least one shared token).
- `parsePlanImport(text, exercises)` returns either `{ ok: false, errors }` or
  `{ ok: true, draft }` where the draft holds the plan content with every exercise reference marked
  `resolved` (exercise id), `newCustom` (defined in `customExercises`) or `unresolved` (name +
  suggestions).
- **Import preview screen:** shows the plan (name, cycle, workouts, exercises) and the list of
  unresolved names. For each one the user either **picks an existing exercise** (suggestions first,
  full picker available) or **creates a custom exercise** (name pre-filled; chooses muscle group,
  equipment and mechanics). The plan can be saved only when nothing is unresolved and
  `validatePlanContent` passes. Saving creates the custom exercises, then the plan, and offers to
  activate it.
- Input methods: **paste text** into a multi-line field, or **pick a file** (`.json`/`.txt`) with the
  system document picker. Files larger than 256 KB are rejected (`fileTooLarge`).

### 4.4 Export

`exportPlan(plan, exercises)` produces the JSON format: built-in exercises by id, custom exercises as
`customExercises` entries with generated keys. Export → import of the result yields an equal
`PlanContent` (round-trip test). The UI shares the JSON through the platform share sheet and also
shows it in a selectable text field (the fallback on web).

### 4.5 Plans created by AI assistants

Users can have any AI chatbot write the plan file (IMPORT_FORMAT.md §8):

- `buildAiPlanPrompt(exercises, locale)` (`src/library/ai-prompt.ts`, pure) returns the prompt: the
  template of IMPORT_FORMAT.md §8.1 (`en`) or §8.2 (`pt-BR`) with `{{EXERCISES}}` replaced by one line
  per non-archived exercise — `id — name — primary muscle — equipment` (name in the locale; muscle
  and equipment as the format's enum values) — built-in exercises in library order, then the
  profile's custom exercises.
- `npm run docs:prompt` generates `docs/AI_PLAN_PROMPT.md` and `docs/AI_PLAN_PROMPT.pt-BR.md` from
  the built-in library; a test fails when they are stale. Another test keeps
  `cycle-plan.schema.json` consistent with the domain constants (enums and numeric limits) and
  imports the example of IMPORT_FORMAT.md §7 without errors or unresolved exercises.
- **Create with AI** on the import screen shows the prompt for the current profile and UI language
  in a selectable field with a *Share* action, plus the four usage steps.
- The README explains the flow step by step (copy the prompt → paste it in a chatbot with your goals
  → copy the JSON answer or save it as `.json` → import it in the app) and links the prompt files.

---

## 5. Load/deload cycles

### 5.1 Cycle suggestion

`suggestCycle(experience)` returns the cycle the app proposes (app-defined heuristics: the more
advanced the lifter, the more often a deload is needed; all values are editable):

| Experience | `loadWeeks` | `deloadWeeks` | volume factor | load factor |
|---|---|---|---|---|
| `beginner` | 8 | 1 | 0.5 | 0.9 |
| `intermediate` | 6 | 1 | 0.5 | 0.9 |
| `advanced` | 4 | 1 | 0.5 | 0.9 |

The experience level (`Experience = 'beginner' | 'intermediate' | 'advanced'`) is asked in
onboarding and editable in Settings (default `intermediate`). The
cycle card's **Suggest** button fills the form with the suggestion; new plans created from scratch or
imported without a `cycle` start from it.

### 5.2 Cycle state (`src/domain/cycle.ts`, pure)

```ts
type Phase = 'load' | 'deload';
interface CycleState {
  cycleNumber: number;          // 1-based
  phase: Phase;
  week: number;                 // 1-based within the phase
  sessionsDoneThisWeek: number; // 0 … sessionsPerWeek − 1
  nextWorkoutIndex: number;     // index into plan.workouts of the suggested next workout
}
const INITIAL_CYCLE_STATE = { cycleNumber: 1, phase: 'load', week: 1, sessionsDoneThisWeek: 0, nextWorkoutIndex: 0 };
```

`completeSession(plan, state, workoutIndex)` — called when a plan workout is finished:

1. `sessionsDoneThisWeek + 1`; `nextWorkoutIndex = (workoutIndex + 1) mod workouts.length`.
2. When `sessionsDoneThisWeek` reaches `sessionsPerWeek` the training week ends (counter back to 0):
   - in `load`: if `week < loadWeeks` → `week + 1`; otherwise the load phase is over → `deload`
     week 1 when `deloadWeeks > 0`, else a new cycle (`cycleNumber + 1`, `load`, week 1);
   - in `deload`: if `week < max(deloadWeeks, 1)` → `week + 1`; otherwise a new cycle.

Manual actions: `startDeload(state)` → `deload`, week 1, counter 0 (same cycle number; works even when
`deloadWeeks` is 0, giving a one-week deload); `startNewCycle(state)` → `cycleNumber + 1`, `load`,
week 1, counter 0 (used for "Skip deload", "End deload" and "Restart cycle"). The user may log any
workout of the plan, not only the suggested one. Editing or deleting past workouts does not rewind the
state.

Acceptance example: 3 workouts, `sessionsPerWeek` 3, `loadWeeks` 4, `deloadWeeks` 1. After 11
completed sessions: cycle 1, load week 4, 2 sessions done. After 12: cycle 1, **deload** week 1, 0
done. After 15: **cycle 2**, load week 1, 0 done.

### 5.3 Deload prescription

In the deload phase, for each plan exercise:

- sets: `max(1, ceil(sets × deloadVolumeFactor))` (4 sets × 0.5 → 2; 3 × 0.5 → 2; 5 × 0.5 → 3);
- load: last **load-phase** work load × `deloadLoadFactor`, rounded to the exercise increment
  (nearest, ties down); no history → no load suggested;
- rep target: `repMin` on every set.

Example: work load 42.5 kg, factor 0.9, increment 2.5 → 38.25 → **37.5 kg**.

### 5.4 Deload advice (`deloadAdvice`, pure)

Given the active plan, its state and the per-exercise session scores (§6.1) of the current cycle:

| Advice | Condition |
|---|---|
| `inDeload` | phase is `deload` |
| `early` | phase is `load` and the plan is **stalling**: among the plan's distinct exercises with ≥ 3 load-phase sessions in the current cycle (*tracked*), the **stalled** ones (§6.3) number at least 2 **and** at least half of the tracked ones. Carries the stalled exercise ids. |
| `upcoming` | phase is `load`, `deloadWeeks > 0` and `week ≥ loadWeeks` (the deload starts after this week) |
| `none` | otherwise |

`early` wins over `upcoming`. The app only **suggests**; the user starts the early deload with one tap
or dismisses the suggestion (dismissal lasts until the next completed session).

### 5.5 Cycle UI

- **Cycle card** (Plan detail and Home): "Cycle 2 · Load week 3 of 6", a week timeline (one cell per
  week: load cells and deload cells, current week highlighted, sessions done this week `2/4`), the
  advice banner when not `none`, and actions: *Start deload now*, *Skip deload* / *End deload*,
  *Restart cycle*.
- **Cycle settings:** load weeks, deload weeks, deload volume and load reduction (shown as
  percentages), **Suggest** button (§5.1).
- A workout started in the deload phase is labeled "Deload" in the logger and in the history.

---

## 6. Automatic load progression (`src/domain/progression.ts`, pure)

**Method: double progression with RIR-based autoregulation.** Each plan exercise has a rep range.
The user first progresses in **reps** at a fixed load; when every set reaches the top of the range
the **load** goes up and the reps restart at the bottom of the range. A logged RIR well above the
target makes the jump bigger; two sessions below the range bring the load down; three sessions
without improvement flag a stall, which feeds the deload advice (§5.4). With `repMin = repMax` the
same rules give classic linear progression. The method was chosen because it needs no 1RM test,
works for every exercise and equipment, is safe for beginners and explainable in one sentence.

### 6.1 Metrics (`src/domain/metrics.ts`)

Only **working sets that are done and have reps ≥ 1** count.

- `e1rm(weightKg, reps, rir = 0)`: `n = reps + rir`; `n = 1` → `weightKg`; otherwise
  `weightKg × (1 + n/30)` (Epley, with RIR added to the reps). Weight 0 → `null`.
  Example: 80 kg × 5 @ RIR 1 → 80 × (1 + 6/30) = **96.0 kg**.
- `setVolume` = `weightKg × reps`; session/exercise volume = sum over the counted sets.
- `workLoad(sets)`: the weight used by the largest number of counted sets; tie → the heaviest.
  `setsAtWorkLoad` = the counted sets at that weight, in logged order.
- `sessionScore(sets)`: the mean e1RM of the counted sets; when every counted set has weight 0, the
  mean reps instead. `null` when there is no counted set.
  Example: 40 kg × 12, 10, 8 → (56 + 53.333… + 50.666…)/3 = **53.333… kg**.

All weight arithmetic avoids floating-point drift (integer grams, or rounding results to 3 decimals).

### 6.2 Suggestion

Input: the plan exercise target (`sets`, `repMin`, `repMax`, `targetRir`), the exercise (equipment),
its increment, the current phase and cycle config, and the exercise's previous sessions (any plan or
free workout, newest first) each tagged with its phase. Only **load-phase** sessions with at least one
counted set are considered; let `last` be the newest and `previous` the one before it.

```ts
type Suggestion = {
  action: 'start' | 'increase' | 'hold' | 'decrease' | 'deload';
  reason: 'noHistory' | 'planStartLoad' | 'hitTopOfRange' | 'hitTopOfRangeEasy' | 'progressReps' | 'belowRange'
        | 'belowRangeTwice' | 'stalled' | 'deloadWeek';
  loadKg: number | null;   // null = no load to suggest (user chooses)
  sets: number;            // target.sets, or the deload sets
  targetReps: number[];    // one per set
  lastLoadKg: number | null;
  lastReps: number[];      // reps of setsAtWorkLoad of `last`
  stalled: boolean;        // §6.3
};
```

Rules, first match wins:

1. **Deload phase** → `deload` / `deloadWeek` per §5.3.
2. **No history** → `start`, `targetReps` = `repMin` × sets; `loadKg` = the plan exercise's
   `startLoadKg` with reason `planStartLoad` when it is set, otherwise `null` with reason `noHistory`.
3. **Top of the range** — `setsAtWorkLoad.length ≥ target.sets` and every one of them has
   `reps ≥ repMax` → `increase`: `loadKg = workLoad + step`, `targetReps` = `repMin` × sets.
   `step` = one increment; **two increments** (`hitTopOfRangeEasy`) when every set at the work load has
   a RIR recorded and `min(RIR) ≥ (targetRir ?? 1) + 2`.
4. **Below the range** — at least half of `setsAtWorkLoad` have `reps < repMin`:
   - if `previous` has the same work load and was also below the range → `decrease` /
     `belowRangeTwice`: `loadKg = floorToIncrement(workLoad × 0.9)`; if that is not lower than the
     work load by at least one increment, use `workLoad − increment`; if the result is < the increment
     (or < 0 for zero-load equipment) → fall through to `hold` / `belowRange`;
   - otherwise → `hold` / `belowRange` with the same load and `targetReps` = `repMin` × sets.
5. **Otherwise** → `hold` / `progressReps`: same load; `targetReps[i] = min(repMax, max(repMin,
   lastReps[i] + 1))` for each set that exists in `last`, `repMin` for additional sets. When the
   exercise is stalled (§6.3) the reason is `stalled` instead (same numbers).

Hand-computed acceptance examples (target 3 × 8–12, increment 2.5 kg, barbell):

| `last` (and `previous`) | Suggestion |
|---|---|
| 40 kg × 12, 12, 12 | `increase` → **42.5 kg**, reps 8, 8, 8 |
| 40 kg × 12, 12, 12, RIR 3, 3, 3 (`targetRir` 1) | `increase` (easy) → **45 kg** |
| 40 kg × 12, 10, 9 | `hold` → 40 kg, reps **12, 11, 10** |
| 40 kg × 8, 7, 6; previous 40 kg × 9, 8, 7 | `hold` / `belowRange` → 40 kg, reps 8, 8, 8 |
| 40 kg × 8, 7, 6; previous 40 kg × 7, 7, 6 | `decrease` → 36 → **35 kg** |
| only 2 sets logged: 40 kg × 12, 12 | `hold` → 40 kg, reps 12, 12, 8 |
| deload week, last load-phase work load 42.5 kg | `deload` → **37.5 kg**, 2 sets, reps 8, 8 |

### 6.3 Stall detection

`isStalled(scoresNewestFirst)`: true when there are at least 3 scores and
`s[0] ≤ s[1]` and `s[1] ≤ s[2]` (no improvement in two consecutive comparisons). Scores are
`sessionScore` values of load-phase sessions. Used by the suggestion (`stalled` flag) and by the
deload advice (§5.4, restricted to the current cycle).

### 6.4 Presentation

Wherever a suggestion is shown (starting a workout, the logger, the plan detail) the app shows the
suggested load and reps and a one-line localized explanation built from the reason and numbers, e.g.
"All 3 sets reached 12 reps at 40 kg → +2.5 kg". Suggestions never overwrite what the user typed and
are always editable.

---

## 7. Logbook (Workout tab)

### 7.1 Model (`src/domain/workout.ts`)

```ts
interface LoggedSet {
  kind: 'working' | 'warmup';
  weightKg: number | null;   // 0–1000, ≤ 2 decimals; 0 only for zero-load equipment (§2.1)
  reps: number | null;       // integer 1–100
  rir: number | null;        // integer 0–10, optional
  done: boolean;
}
interface WorkoutExercise {
  exerciseId: string;
  planExerciseId: string | null;
  target: { sets: number; repMin: number; repMax: number; targetRir?: number; restSeconds?: number } | null; // snapshot
  note: string;              // ≤ 500 chars
  sets: LoggedSet[];
}
interface Workout {
  id: number; profileId: number;
  planId: number | null; planWorkoutId: string | null;
  name: string;              // plan workout name, or a default name for a free workout
  status: 'in_progress' | 'completed';
  phase: Phase; cycleNumber: number | null; cycleWeek: number | null;
  startedAt: string; completedAt: string | null;
  notes: string;             // ≤ 500 chars
  exercises: WorkoutExercise[];
}
```

`ExerciseSession` (`workoutId`, `completedAt`, `phase`, `cycleNumber`, `planId`, `sets`) is one past
session of one exercise — the unit read by progression (§6) and statistics (§9), newest first.

### 7.2 Starting

- **From the plan:** the Workout tab (and Home) shows the suggested next workout of the active plan
  with a preview (exercises, suggested loads); the user can choose another workout of the plan.
  `buildWorkout(planWorkout, suggestions)` creates the draft: one entry per plan exercise with
  `suggestion.sets` working sets, weight pre-filled with `suggestion.loadKg` (empty when `null`), reps
  empty with the target reps shown as placeholder.
- **Free workout:** starts empty; exercises are added with the picker.
- At most one workout is in progress per profile. With one in progress, the tab opens it (resume);
  starting another requires discarding it (confirmation).

### 7.3 Logging

For each exercise card: name, target (`3 × 8–12 · RIR 2`), the suggestion line (§6.4), "last time"
(the sets of the previous session of that exercise) and the set rows:

| Field | Rule |
|---|---|
| Weight (kg) | locale-aware decimal input; required to mark the set done |
| Reps | integer; when empty, marking the set done commits the placeholder target reps |
| RIR | optional |
| Done ✓ | toggles; a done set is validated (invalid → inline localized error, stays not done) |
| Warm-up | toggle per set (long-press menu or a set-type button) |

Actions: add set (copies the previous set's weight), remove set, add exercise (picker), remove
exercise, replace exercise (this session only), exercise note, workout notes. Every change is saved
immediately (the draft survives closing the app).

### 7.4 Finishing

- **Finish** requires at least one done working set; sets not marked done are discarded. The workout
  becomes `completed` with `completedAt` = now; for a plan workout the cycle state advances (§5.2).
- **Summary:** duration, exercises, working sets, total volume (kg), and the PRs achieved (§9.2).
- **Discard** deletes the in-progress workout (confirmation).

---

## 8. History

- List of completed workouts, newest first: date, name, plan, phase label, sets, volume. Filter by
  plan and by exercise.
- Detail: every exercise with its sets (weight × reps, RIR, warm-ups marked), notes, volume, e1RM of
  the best set, and the comparison with the previous session of the same exercise.
- **Edit** a completed workout (same validation as logging; the date, phase and cycle position are
  kept) and **delete** it (confirmation). Neither changes the cycle state.

---

## 9. Progress

### 9.1 Per exercise

Exercise selector (exercises with at least one completed session, most recently trained first), period
filter (4 weeks, 3 months, 6 months, 1 year, all) and a metric toggle:

- **e1RM** — best e1RM of the session (§6.1);
- **Top weight** — heaviest counted set;
- **Volume** — exercise volume of the session.

One point per session; tapping a point shows date and value. Charts use `react-native-svg` and the
existing in-house line chart. Zero-load exercises show **reps** (best set) instead of e1RM/top weight.

### 9.2 Personal records (`src/domain/stats.ts`)

Per exercise: **weight PR** (heaviest counted set; tie → more reps) and **e1RM PR** (highest e1RM),
each with date. `newRecords(workout, historyBefore)` lists the PRs set by a workout (shown in the
summary and marked in the history). The first session of an exercise sets no PR.

### 9.3 Weekly volume per muscle group

Working done sets per muscle group per ISO week (Monday–Sunday, device time zone): the primary muscle
counts 1 set, each secondary muscle 0.5. The Progress tab shows the current week and the previous one
as a list of bars ordered by the muscle group order of §2.1.

---

## 10. Home, onboarding and settings

- **Home:** resume card when a workout is in progress; otherwise the next workout of the active plan
  (name, phase, "Start"); the cycle card (§5.5) with the deload advice; this training week's sessions
  (`2/4`); the last 3 workouts. Without a plan: a call to action to create one (template / import /
  scratch) and a "Free workout" button.
- **Onboarding** (first run of a profile): experience level (§5.1), then "Choose a template",
  "Import a plan" or "Later". Profiles that completed the v1 onboarding skip it.
- **Settings:** language (System / English / Português), theme (dark / light), profiles (create,
  rename, switch — all data is per profile), experience level.

---

## 11. Technical requirements

### 11.1 Layered architecture (mandatory separation)

```
src/
  domain/      # pure logic: exercise, exercise-match, plan, plan-import, cycle, metrics,
               # progression, workout, stats, rounding, chart-scale, validation
  library/     # pure data: exercises/*.ts, plan-templates/*.ts, registries
  data/        # persistence: expo-sqlite, migrations, repositories (interfaces + memory + sqlite)
  state/       # zustand store and selectors connecting data ↔ domain ↔ UI
  components/  # UI (screens and reusable components), one folder per feature
  i18n/        # catalogs (one module per namespace and locale), t(), locale detection, formatters
  app/         # Expo Router routes (screens and layouts only)
```

- `domain/` and `library/` import nothing from React, Expo, `data/`, `state/` or `i18n/`
  (`library/` may import types and validators from `domain/`). Domain code returns codes, never
  display strings.
- `data/` exposes repository interfaces; tests use the in-memory implementation; the SQLite
  implementation passes the same contract tests (node:sqlite in tests).
- No random or mock values in production code.

### 11.2 Persistence

- `expo-sqlite`; versioned migrations in `src/data/migrations/NNN_*.ts`. Migrations 001–009 (v1) are
  **immutable**. Migration `010` adds the v2 tables:
  `custom_exercises`, `exercise_settings` (increment override), `plans` (content JSON + cycle state
  JSON + `archived_at`), `workouts`, `workout_exercises`, `workout_sets`; and the settings columns
  `experience` and `active_plan_id`.
- Repositories: `ExerciseRepository` (custom exercises, increment overrides), `PlanRepository`
  (CRUD, archive, active plan, cycle state), `WorkoutRepository` (save draft, complete, amend, delete,
  list, sessions of an exercise). All data is scoped by `profile_id`.

### 11.3 v1 data

- v1 tables are left in place and untouched (no destructive migration).
- Migration `010` copies every **completed** v1 performed session into the v2 logbook: one workout
  (name = v1 program name, phase `load`, original start/completion dates and notes) with one exercise
  — `bench` → `barbell-bench-press`, `squat` → `barbell-back-squat`, `deadlift` →
  `conventional-deadlift` — and its sets with weight and reps (RIR kept when it is an integer,
  otherwise rounded down; sets without weight or reps are skipped; all `working`, `done`).
- `settings.onboarding_completed` keeps its meaning (§10).

### 11.4 Quality

- TDD (AGENTS.md). Coverage: `src/domain/` and `src/library/` ≥ 95 % lines; global ≥ 80 %.
- Jest (`jest-expo`) + `@testing-library/react-native`; UI tests query by role/label/text, in both
  locales for screens that show formatted numbers.
- CI (existing): `npx expo lint`, `npx tsc --noEmit`, `npm test -- --coverage` on every PR and push
  to `main`.

### 11.5 Build and distribution (unchanged from v1)

Every push to `main` builds the Android APK in Docker (`.github/workflows/android-apk.yml`) and
publishes it to the rolling `latest-main` pre-release. New native dependencies must be Expo modules
installed with `npx expo install` and must not require hand-edited native projects. The app version
becomes `2.0.0`.

---

## 12. Design and UX

- Name **CYCLE**; the v1 visual identity is kept: dark theme by default (light option), palette
  background `#000000` / `#121212` / `#1C1C1E`, text `#FFFFFF` / `#A1A1AA`, accent red `#D32F2F`
  (primary action, PR highlight, selection), borders `#2A2A2A`; tabular numbers.
- No decorative animation. Touch targets ≥ 44 pt, `accessibilityLabel` on every control, AA contrast.
- The logger is optimized for one-handed use in the gym: large inputs, numeric keyboards, minimal
  navigation depth.
- Navigation:
  - Mobile (5 tabs): **Home**, **Plan**, **Workout**, **Progress**, **More** (Exercises, History,
    Settings).
  - Wide screens (≥ 900 px): sidebar with Home, Plan, Workout, Progress, Exercises, History, Settings.
- Routes: `(tabs)/index|plan|workout|progress|more`, `plans/index`, `plans/new`, `plans/templates`,
  `plans/import`, `plans/[id]`, `plans/[id]/edit`, `exercises/index`, `exercises/new`,
  `exercises/[id]`, `history/index`, `history/[id]`, `settings`.

### 12.1 Internationalization

- UI languages: English (`en`, source catalog) and Brazilian Portuguese (`pt-BR`, typed against `en`
  so a missing key is a type error). Default from the device locale; override in Settings.
- Catalogs are split by namespace: `src/i18n/locales/<locale>/<namespace>.ts`, combined in
  `src/i18n/locales/<locale>.ts`. No hard-coded UI strings in components (enforced by the existing
  test).
- Numbers and dates are locale-aware (`42.5 kg` / `42,5 kg`); numeric inputs accept the locale's
  decimal separator. Units are always kg.
- pt-BR UI vocabulary: Plan → "Periodização", Workout → "Treino", Set → "Série", Reps → "Repetições",
  Load → "Carga", Deload → "Deload", Warm-up → "Aquecimento", Exercise → "Exercício".

---

## 13. Acceptance flow (E2E test, in-memory repositories)

1. First run → onboarding: pick **Intermediate**, choose "Import a plan".
2. Paste this text and continue:

   ```
   # My plan
   cycle: 2+1
   sessions: 2

   ## A
   Supino reto com barra | 3x8-12
   Minha remada especial | 3x8-12

   ## B
   Agachamento livre | 3x6-10
   ```

3. The preview resolves "Supino reto com barra" and "Agachamento livre" and reports
   "Minha remada especial" as unresolved → create it as a custom exercise (back, machine, compound)
   → save and activate the plan.
4. Home shows cycle 1, load week 1 of 2, next workout **A**. Start it: no history → no suggested
   load. Log bench 40 kg × 12, 12, 12 and the custom row 30 kg × 10, 10, 10 → finish → summary shows
   6 sets and volume 40×36 + 30×30 = **2 340 kg**.
5. Start and finish **B** (squat 60 kg × 10, 10, 10) → the training week ends → load week 2.
6. Start **A** again: bench suggests **42.5 kg** (top of range reached) with the explanation; the
   custom row (machine, increment 5 kg) suggests holding 30 kg with reps 11, 11, 11.
7. Finish A and B again → the cycle enters **deload** week 1; Home announces the deload. Starting A
   shows 2 sets per exercise and the bench load at 90 % of the last load-phase work load, rounded to
   2.5 kg.
8. History lists the workouts; Progress shows two points on the bench chart and a bench weight PR.
9. Switch the language to Português → all screens render in pt-BR with `42,5 kg` formatting.

---

## 14. Non-functional notes

- All suggestion logic is deterministic and synchronous; building a workout with suggestions for 30
  exercises over 500 logged sessions takes < 50 ms.
- The app works fully offline; there is no account and no network call.

## 15. Out of scope (v2.0)

Cloud sync/accounts, social features, LLM-generated plans, timed/cardio exercises, rest timer,
supersets/drop-set modeling (use notes), lb units, calendar-date scheduling of workouts, body
measurements, languages other than English and Brazilian Portuguese, import of other apps' formats.
