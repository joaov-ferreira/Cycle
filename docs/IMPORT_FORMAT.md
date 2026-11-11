# CYCLE plan import format — data specification

> Normative specification of the JSON document CYCLE imports as a training plan
> ("periodização"). Format name **`cycle-plan`**, version **1**. A machine-readable JSON Schema is in
> [`cycle-plan.schema.json`](./cycle-plan.schema.json). The product rules around the import flow are
> in [`SPEC.md`](./SPEC.md) §4; the ready-to-paste prompt for AI chatbots is in
> [`AI_PLAN_PROMPT.md`](./AI_PLAN_PROMPT.md) (generated, see §8).

## 1. Purpose

One JSON file describes one plan: its workouts (training days), the exercises of each workout with
their set and rep targets — or with loads written as percentages of a one-repetition maximum (1RM),
or generated from a built-in program — and the load/deload cycle. The file can be written by hand, exported by
the app, or produced by an AI assistant from the prompt in §8. The app never trusts the file: it is
parsed, validated and shown in a preview before anything is saved.

## 2. Document

- Encoding: UTF-8. Maximum size: 256 KB.
- One JSON object. Unknown properties are **ignored** (they never cause an error).
- All weights are kilograms. All durations are seconds.
- Text pasted from a chatbot is accepted as is: the importer uses the first ```` ```json ```` (or
  plain ```` ``` ````) fenced block when there is one; otherwise the text from the first `{` to the
  last `}`.

### 2.1 Top level

| Property | Type | Required | Rule | Default |
|---|---|---|---|---|
| `format` | string | yes | exactly `"cycle-plan"` | — |
| `version` | integer | yes | exactly `1` | — |
| `name` | string | yes | 1–60 characters after trimming | — |
| `description` | string | no | ≤ 500 characters | `""` |
| `sessionsPerWeek` | integer | no | 1–14: how many sessions make one training week | number of workouts |
| `cycle` | object | no | §2.2 | the app's suggestion for the user's experience level |
| `customExercises` | array | no | §2.3; 0–50 entries | `[]` |
| `referenceMaxes` | array | no | §2.8; 0–50 entries; **needs CYCLE 4.0 or later** | `[]` |
| `workouts` | array | yes | §2.4; 1–14 entries | — |

### 2.2 `cycle`

Every property is optional; a missing one takes the default.

| Property | Type | Rule | Default |
|---|---|---|---|
| `loadWeeks` | integer | 1–16: training weeks of normal (progressive) training | 6 |
| `deloadWeeks` | integer | 0–2: deload weeks after the load weeks (0 = no scheduled deload) | 1 |
| `deloadVolumeFactor` | number | 0.3–1.0: fraction of the sets kept during a deload | 0.5 |
| `deloadLoadFactor` | number | 0.5–1.0: fraction of the working load used during a deload | 0.9 |
| `rirRamp` | object or null | `{ "start": 3, "end": 0 }` — integers 0–5 with `start ≥ end`: the target RIR falls linearly from `start` (first load week) to `end` (last load week) and replaces each exercise's `rir` during the load weeks; the deload uses `start` | none |

The two factors are rounded to the nearest 0.05.

### 2.3 `customExercises[]`

Defines an exercise that is not in the app's built-in library. It is created in the user's library
when the plan is saved.

| Property | Type | Required | Rule |
|---|---|---|---|
| `key` | string | yes | 1–60 characters in kebab-case (lowercase letters and digits separated by single hyphens, e.g. `hammer-row`); unique in the document; must not be a built-in exercise id. Readers also accept leading, trailing or doubled hyphens |
| `name` | string | yes | 1–60 characters |
| `primaryMuscle` | string | yes | one of the muscle groups below |
| `secondaryMuscles` | string[] | no | muscle groups, without the primary one, no duplicates (default `[]`) |
| `equipment` | string | yes | one of the equipment values below |
| `mechanics` | string | no | `"compound"` or `"isolation"` (default `"compound"`) |

Muscle groups: `chest`, `back`, `shoulders`, `traps`, `biceps`, `triceps`, `forearms`, `abs`,
`lowerBack`, `glutes`, `quads`, `hamstrings`, `adductors`, `abductors`, `calves`.

Equipment: `barbell`, `dumbbell`, `machine`, `cable`, `smith`, `kettlebell`, `bodyweight`, `band`,
`other`.

### 2.4 `workouts[]`

| Property | Type | Required | Rule |
|---|---|---|---|
| `name` | string | yes | 1–40 characters |
| `programs` | array | no | §2.7; 0–4 program blocks, generated before `exercises`; **needs CYCLE 4.0 or later** |
| `exercises` | array | yes | §2.5; 1–30 entries, in training order. May be empty (or omitted) when `programs` has at least one entry |

### 2.5 `workouts[].exercises[]`

| Property | Type | Required | Rule |
|---|---|---|---|
| `exercise` | string | yes | reference to an exercise, §3 |
| `sets` | integer | yes, unless `percent` is given | 1–20 working sets; ignored with `percent` |
| `repMin` | integer | one of the two forms, unless `percent` is given | 1–100 |
| `repMax` | integer | one of the two forms, unless `percent` is given | `repMin`–100 |
| `reps` | string or integer | one of the two forms, unless `percent` is given | `"8-12"`, `"10"` or `10` (a single number means `repMin = repMax`) |
| `percent` | object | no | §2.6: a percent-of-1RM scheme instead of `sets` / `reps`; **needs CYCLE 4.0 or later** |
| `rir` | integer | no | 0–5: target reps in reserve. Not allowed with `percent` |
| `rest` | integer | no | 0–900: rest between sets, seconds |
| `startLoad` | number | no | 0–1000 kg, ≤ 2 decimals: load suggested for the first session, used only while the exercise has no history. 0 is valid only for `bodyweight` and `band` exercises. Not allowed with `percent` |
| `note` | string | no | ≤ 200 characters |
| `superset` | string | no | 1–10 characters: a label shared by 2–4 **consecutive** exercises of the workout that are performed back to back (rest only after the last one) |

The rep target is given either as `repMin` **and** `repMax`, or as `reps`. When both forms are
present, `repMin`/`repMax` win.

### 2.6 `percent`

A scheme that prescribes the loads as percentages of a reference 1RM. The app multiplies the 1RM by
the percentage and rounds to the exercise's increment; an exercise without a 1RM asks the user for
it. Use it for strength and powerlifting programs; keep accessories on rep ranges (§2.5).

| Property | Type | Required | Rule | Default |
|---|---|---|---|---|
| `weeks` | array of arrays | yes | 1–16 weeks, in order; each week is an array of groups (below), at most 20 groups and 40 sets in total. An empty week `[]` means the exercise is not trained that week. At least one week must have groups. A scheme shorter than the cycle repeats | — |
| `startWeek` | integer | no | 1…number of weeks: the scheme week of the first cycle week | 1 |
| `of` | string | no | reference to the exercise whose 1RM the percentages refer to (§3) | the exercise itself |

A group of a week:

| Property | Type | Required | Rule | Default |
|---|---|---|---|---|
| `sets` | integer | no | 1–20: number of identical sets | 1 |
| `reps` | integer | yes | 1–100 (the minimum when `amrap`) | — |
| `percent` | number | no | 1–120, steps of 0.5: percent of the 1RM. Without it no load can be calculated | — |
| `addKg` | number | no | −100…100 kg, ≤ 2 decimals: added after the percentage | 0 |
| `amrap` | boolean | no | `true`: as many reps as possible; `reps` is the minimum | `false` |

With `percent`, the exercise-level `sets`, `repMin`, `repMax` and `reps` are not required and are
ignored (the app keeps a summary of the scheme in them); `rir` and `startLoad` are rejected with
`notAllowedWithPercent`. `rest`, `note` and `superset` work as usual.

### 2.7 `workouts[].programs[]`

A program block generates the exercises of one day of a built-in program (for example Smolov Jr.,
Sheiko) every week, ahead of the workout's own `exercises`. Programs name *roles* ("the squat of the
program") that the file maps to exercises. Chatbots are not given the program list: this section is
for files written by hand or by tools that know the app.

| Property | Type | Required | Rule | Default |
|---|---|---|---|---|
| `program` | string | yes | id of a built-in program (`cycle-531-custom`, `smolov-jr`, `smolov`, `sheiko-29`, `sheiko-30`, `sheiko-31`, `sheiko-32`, `sheiko-37`); unknown ids are `unknownProgram` | — |
| `day` | integer | yes | 1…days per week of the program | — |
| `startWeek` | integer | no | 1…duration of the program in weeks: the program week of the first cycle week | 1 |
| `roles` | object | yes | role id → exercise reference (§3); at least one role. Unknown roles are `unknownRole`; items of unmapped roles are left out | — |
| `accessories` | boolean | no | include the program's accessory exercises | `false` |
| `params` | object | no | parameter id → number, within the program's range and step (`unknownParam`, `paramOutOfRange`, `paramOffStep`); omitted parameters take the program's default | `{}` |

### 2.8 `referenceMaxes[]`

The athlete's current 1RMs, so the percentages can be turned into loads at once.

| Property | Type | Required | Rule |
|---|---|---|---|
| `exercise` | string | yes | reference to an exercise (§3) |
| `kg` | number | yes | > 0 and ≤ 1000, at most 2 decimals |

A value is saved **only for an exercise that has no reference 1RM yet**; the import preview lists
what will be set and what is kept. When an exercise is listed twice the last value counts.
Include 1RMs only with values the athlete gave: never invent them.

> Files that use `percent`, `programs` or `referenceMaxes` need **CYCLE 4.0 or later**: older versions
> reject an exercise without `sets` and ignore the other properties.

## 3. Exercise references

`exercise` is resolved in this order:

Every reference of the document is resolved the same way: `exercise`, `percent.of`, the targets of
`roles`, and `referenceMaxes[].exercise`.

1. the `key` of an entry of `customExercises` in the same document;
2. the id of a built-in exercise (kebab-case, e.g. `barbell-bench-press`; the full list is part of
   the AI prompt and of the Exercises screen);
3. an exact match, after normalization, with the English name, the Portuguese name or an alias of a
   built-in exercise or of a custom exercise the user already has.

Normalization: lowercase, remove diacritics, replace every run of non-alphanumeric characters with
one space, trim (`"Supino Reto c/ Barra"` → `"supino reto c barra"`).

The importer **never guesses**. A reference that matches nothing does not fail the import: it is
listed as *unresolved* in the preview, where the user maps it to an existing exercise or creates a
custom exercise for it. Documents written by tools should therefore use ids (rule 2) or define
`customExercises` (rule 1).

## 4. How the app uses the targets (load progression)

The plan carries targets, not loads; the app derives the loads from the user's logbook with **double
progression** (SPEC §6):

- While not every set reaches `repMax`, the load stays and the app asks for one more rep per set.
- When every planned set reaches `repMax`, the load goes up by one increment of the exercise
  (two increments when the sets were logged with RIR at least 2 above the target) and the reps restart
  at `repMin`.
- After two consecutive sessions with at least half of the sets below `repMin`, the load goes down
  about 10 %.
- In a deload week the sets are multiplied by `deloadVolumeFactor`, the load by `deloadLoadFactor`
  and the reps are `repMin`.

A **percent scheme** (§2.6) replaces double progression for that exercise: the weeks of the scheme
are the progression, and the load of every set is `1RM × percent` plus `addKg`, rounded to the
exercise's increment (ties round down). In a deload week the scheme of the first week is used with
fewer sets (`deloadVolumeFactor`) and lighter loads (`deloadLoadFactor`).

Consequences for whoever writes a plan: give a **range** (`"8-12"`) to get double progression; a
single number (`"5"`) gives linear progression (the load goes up every time all sets reach it); use
`startLoad` only when the user's current load is known.

## 5. Errors

A document that cannot be read is rejected as a whole with a list of `{ path, code }` (the UI
localizes the codes; `path` is a JSON path such as `workouts[1].exercises[0].sets`).

| Code | Meaning |
|---|---|
| `invalidJson` | the text is not valid JSON |
| `fileTooLarge` | more than 256 KB |
| `notAnObject` | the document is not a JSON object |
| `unsupportedFormat` | `format` missing or not `"cycle-plan"` |
| `unsupportedVersion` | `version` missing or not `1` |
| `required` | a required property is missing |
| `invalidType` | wrong JSON type |
| `tooShort` / `tooLong` | text length or array size outside its limits |
| `outOfRange` | number outside its limits |
| `notInteger` | integer expected |
| `invalidValue` | value outside an enumeration, or a malformed `reps` / `key` |
| `invalidRepRange` | `repMax` lower than `repMin` |
| `missingRepTarget` | neither `reps` nor `repMin`+`repMax` |
| `duplicateKey` | two `customExercises` share a `key`, or a `key` equals a built-in id |
| `notAllowedWithPercent` | `rir` or `startLoad` on an exercise that has `percent` |
| `emptyScheme` | every week of a `percent` scheme is empty |
| `unknownProgram` | `program` is not a built-in program id |
| `unknownRole` | a `roles` key is not a role of the program |
| `unknownParam` | a `params` key is not a parameter of the program |
| `paramOutOfRange` | a `params` value is outside the parameter's range |
| `paramOffStep` | a `params` value does not match the parameter's step |

`percent` problems are reported with the path of the offending value, for example
`workouts[0].exercises[1].percent.weeks[2][0].percent`; there `sets` is the group's repeat count.
Percentages outside 1–120 are `outOfRange`, off the 0.5 step `invalidValue`. In `programs[]`, `day`
and `startWeek` beyond the program are `outOfRange`.

Unresolved exercise references are not errors (§3).

## 6. Versioning

`version` changes only for incompatible changes. New optional properties are added without a version
change (readers ignore unknown properties). The app exports the version it imports. `percent`,
`programs` and `referenceMaxes` were added with CYCLE 4.0 (§2.6–§2.8); a reader older than 4.0 rejects
a percent exercise (missing `sets`) and ignores the rest.

## 7. Example

```json
{
  "format": "cycle-plan",
  "version": 1,
  "name": "Upper / Lower 4x",
  "description": "Hypertrophy, four sessions a week.",
  "sessionsPerWeek": 4,
  "cycle": { "loadWeeks": 6, "deloadWeeks": 1, "deloadVolumeFactor": 0.5, "deloadLoadFactor": 0.9 },
  "customExercises": [
    {
      "key": "hammer-strength-row",
      "name": "Hammer Strength row",
      "primaryMuscle": "back",
      "secondaryMuscles": ["biceps"],
      "equipment": "machine",
      "mechanics": "compound"
    }
  ],
  "workouts": [
    {
      "name": "Upper A",
      "exercises": [
        { "exercise": "barbell-bench-press", "sets": 4, "reps": "6-10", "rir": 2, "rest": 150, "startLoad": 60 },
        { "exercise": "hammer-strength-row", "sets": 4, "reps": "8-12", "rir": 2, "rest": 120 },
        { "exercise": "overhead-press", "sets": 3, "reps": "8-12", "rir": 2, "rest": 120 },
        { "exercise": "lat-pulldown", "sets": 3, "reps": "10-15", "rir": 1, "rest": 90 },
        { "exercise": "dumbbell-curl", "sets": 3, "reps": "10-15", "rir": 1, "rest": 60 },
        { "exercise": "triceps-pushdown", "sets": 3, "reps": "10-15", "rir": 1, "rest": 60 }
      ]
    },
    {
      "name": "Lower A",
      "exercises": [
        { "exercise": "barbell-back-squat", "sets": 4, "reps": "6-10", "rir": 2, "rest": 180 },
        { "exercise": "romanian-deadlift", "sets": 3, "reps": "8-12", "rir": 2, "rest": 150 },
        { "exercise": "leg-extension", "sets": 3, "reps": "10-15", "rir": 1, "rest": 90 },
        { "exercise": "leg-curl", "sets": 3, "reps": "10-15", "rir": 1, "rest": 90 },
        { "exercise": "standing-calf-raise", "sets": 4, "reps": "10-15", "rir": 1, "rest": 60 }
      ]
    }
  ]
}
```

### 7.1 Strength example

Main lifts on percent schemes, accessories on rep ranges, a program block, and the athlete's 1RMs:

```json
{
  "format": "cycle-plan",
  "version": 1,
  "name": "Strength base",
  "sessionsPerWeek": 3,
  "cycle": { "loadWeeks": 3, "deloadWeeks": 1, "deloadVolumeFactor": 0.5, "deloadLoadFactor": 0.9 },
  "referenceMaxes": [
    { "exercise": "barbell-back-squat", "kg": 140 },
    { "exercise": "barbell-bench-press", "kg": 100 }
  ],
  "workouts": [
    {
      "name": "Squat day",
      "exercises": [
        {
          "exercise": "barbell-back-squat",
          "rest": 240,
          "percent": {
            "weeks": [
              [ { "sets": 3, "reps": 5, "percent": 75 } ],
              [ { "sets": 3, "reps": 3, "percent": 85 } ],
              [ { "sets": 2, "reps": 1, "percent": 95 }, { "reps": 1, "percent": 95, "amrap": true } ]
            ]
          }
        },
        { "exercise": "leg-curl", "sets": 3, "reps": "10-15", "rir": 2 }
      ]
    },
    {
      "name": "Bench day",
      "programs": [
        { "program": "smolov-jr", "day": 2, "roles": { "lift": "barbell-bench-press" }, "accessories": false, "params": { "weeklyIncrementKg": 2.5 } }
      ],
      "exercises": [
        { "exercise": "lat-pulldown", "sets": 3, "reps": "8-12", "rir": 2 }
      ]
    }
  ]
}
```

## 8. Prompt for AI assistants

The app can build a plan file with any AI chatbot (ChatGPT, Claude, Gemini, …). The prompt is the
template below followed by the app's exercise list, so the assistant uses exercise ids the app knows.

- `src/library/ai-prompt.ts` exports `buildAiPlanPrompt(exercises, locale)`, which fills the template
  for `en` or `pt-BR` with one line per exercise: `id — name — primary muscle — equipment`
  (non-archived exercises, library order, then the user's custom exercises).
- `npm run docs:prompt` writes the result for the built-in library to `docs/AI_PLAN_PROMPT.md` (en)
  and `docs/AI_PLAN_PROMPT.pt-BR.md`; a test fails when those files are out of date.
- In the app, **Plan → New → Import → Create with AI** shows the same prompt (including the user's
  custom exercises, in the UI language) with *Share* / select-and-copy.

### 8.1 Template (`en`)

````text
You are an experienced strength and hypertrophy coach. Create a weight-training plan for me and deliver it as a file for the CYCLE app.

BEFORE WRITING THE PLAN
You need to know: my goal (hypertrophy, strength, general fitness…), my training experience (beginner, intermediate or advanced), how many days per week I can train and for how long, the equipment I have (full gym, home gym, dumbbells only…), injuries or movements to avoid, exercises I like or dislike, and — optionally — the loads I currently use. If any of this is missing from my message, ask me first and wait for my answer. Do not invent my data.

OUTPUT
Reply with ONE JSON document inside a single ```json code block, with no comments and nothing else in the block. You may add a short explanation after the block. The document must follow this format:

{
  "format": "cycle-plan",
  "version": 1,
  "name": "plan name, up to 60 characters",
  "description": "optional, up to 500 characters",
  "sessionsPerWeek": 4,
  "cycle": { "loadWeeks": 6, "deloadWeeks": 1, "deloadVolumeFactor": 0.5, "deloadLoadFactor": 0.9 },
  "customExercises": [
    { "key": "my-exercise", "name": "Exercise name", "primaryMuscle": "back",
      "secondaryMuscles": ["biceps"], "equipment": "machine", "mechanics": "compound" }
  ],
  "workouts": [
    { "name": "workout name, up to 40 characters",
      "exercises": [
        { "exercise": "barbell-bench-press", "sets": 4, "reps": "8-12", "rir": 2, "rest": 120,
          "startLoad": 60, "note": "optional, up to 200 characters" },
        { "exercise": "barbell-back-squat", "rest": 240,
          "percent": { "weeks": [ [ { "sets": 3, "reps": 5, "percent": 75 } ],
                                  [ { "sets": 3, "reps": 3, "percent": 85 }, { "sets": 1, "reps": 1, "percent": 90, "amrap": true } ] ] } }
      ] }
  ]
}

RULES
1. "exercise" must be an id from the EXERCISE LIST below, copied exactly. Only when the exercise I need is not in the list, define it in "customExercises" and use its "key" as "exercise".
2. primaryMuscle / secondaryMuscles: chest, back, shoulders, traps, biceps, triceps, forearms, abs, lowerBack, glutes, quads, hamstrings, adductors, abductors, calves. equipment: barbell, dumbbell, machine, cable, smith, kettlebell, bodyweight, band, other. mechanics: compound or isolation.
3. Limits: 1–14 workouts; 1–30 exercises per workout; sets 1–20; reps 1–100; rir 0–5; rest 0–900 seconds; sessionsPerWeek 1–14; loadWeeks 1–16; deloadWeeks 0–2; deloadVolumeFactor 0.3–1; deloadLoadFactor 0.5–1.
4. "reps" is a range such as "8-12". The app uses double progression: I add reps inside the range and the app raises the load when every set reaches the top of the range, so always give a range (a single number such as "5" means the load goes up whenever all sets reach it).
5. "rir" is the target reps in reserve and "rest" the rest between sets in seconds.
6. "startLoad" (kg) only when I told you the load I use on that exercise; otherwise leave it out.
7. "sessionsPerWeek" is the number of sessions I do per week; the workouts are done in rotation.
8. "cycle": loadWeeks 8 for a beginner, 6 for an intermediate, 4 for an advanced lifter, followed by 1 deload week, unless I ask for something else.
9. All weights in kilograms. Write names and notes in the language I am using.
10. Supersets: to have 2 to 4 consecutive exercises done back to back, give each of them the same "superset" label, for example "superset": "A". Leave it out otherwise.
11. Effort ramp (optional): add "rirRamp": { "start": 3, "end": 0 } inside "cycle" to make the target RIR fall week by week during the load weeks. Use it only if I ask for it or it suits my experience.

12. Strength, powerlifting or percentage-based programs: when I ask for one, give the main lifts a "percent" scheme instead of "sets" and "reps" (leave out "rir" and "startLoad" on those exercises). "weeks" lists the weeks in order, one array per week; a scheme shorter than the cycle repeats. Each week is a list of groups: "sets" is the number of identical sets, "reps" the reps per set, "percent" the percentage of my 1RM (1–120, steps of 0.5). Optional: "amrap": true for an as-many-reps-as-possible set (reps is then the minimum), "addKg" (−100 to 100) to add or subtract fixed kilograms, an empty week [] to skip the exercise that week. Optional on "percent": "of", the exercise whose 1RM the percentages refer to (default: the exercise itself), and "startWeek", the scheme week of the first training week. Limits: 1–16 weeks, up to 20 groups and 40 sets per week. Keep the accessories on rep ranges with "reps": "8-12".
13. "referenceMaxes" (optional, up to 50) is a list of objects with "exercise" (an id from the list) and "kg" (for example 140) holding my current 1RMs. Include it only with values I gave you; never invent a 1RM.

EXERCISE LIST (id — name — primary muscle — equipment)
{{EXERCISES}}
````

### 8.2 Template (`pt-BR`)

````text
Você é um treinador experiente de força e hipertrofia. Monte uma periodização de musculação para mim e entregue como um arquivo para o app CYCLE.

ANTES DE MONTAR O TREINO
Você precisa saber: meu objetivo (hipertrofia, força, condicionamento geral…), minha experiência de treino (iniciante, intermediário ou avançado), quantos dias por semana posso treinar e por quanto tempo, os equipamentos que tenho (academia completa, academia em casa, só halteres…), lesões ou movimentos a evitar, exercícios de que gosto ou não gosto e — opcionalmente — as cargas que uso hoje. Se algo disso faltar na minha mensagem, pergunte primeiro e espere a minha resposta. Não invente os meus dados.

SAÍDA
Responda com UM documento JSON dentro de um único bloco de código ```json, sem comentários e sem mais nada dentro do bloco. Você pode acrescentar uma explicação curta depois do bloco. O documento deve seguir este formato (os nomes das propriedades ficam em inglês, exatamente como abaixo):

{
  "format": "cycle-plan",
  "version": 1,
  "name": "nome da periodização, até 60 caracteres",
  "description": "opcional, até 500 caracteres",
  "sessionsPerWeek": 4,
  "cycle": { "loadWeeks": 6, "deloadWeeks": 1, "deloadVolumeFactor": 0.5, "deloadLoadFactor": 0.9 },
  "customExercises": [
    { "key": "meu-exercicio", "name": "Nome do exercício", "primaryMuscle": "back",
      "secondaryMuscles": ["biceps"], "equipment": "machine", "mechanics": "compound" }
  ],
  "workouts": [
    { "name": "nome do treino, até 40 caracteres",
      "exercises": [
        { "exercise": "barbell-bench-press", "sets": 4, "reps": "8-12", "rir": 2, "rest": 120,
          "startLoad": 60, "note": "opcional, até 200 caracteres" },
        { "exercise": "barbell-back-squat", "rest": 240,
          "percent": { "weeks": [ [ { "sets": 3, "reps": 5, "percent": 75 } ],
                                  [ { "sets": 3, "reps": 3, "percent": 85 }, { "sets": 1, "reps": 1, "percent": 90, "amrap": true } ] ] } }
      ] }
  ]
}

REGRAS
1. "exercise" deve ser um id da LISTA DE EXERCÍCIOS abaixo, copiado exatamente. Somente quando o exercício de que preciso não estiver na lista, defina-o em "customExercises" e use a "key" dele em "exercise".
2. primaryMuscle / secondaryMuscles: chest (peito), back (costas), shoulders (ombros), traps (trapézio), biceps (bíceps), triceps (tríceps), forearms (antebraços), abs (abdômen), lowerBack (lombar), glutes (glúteos), quads (quadríceps), hamstrings (posteriores de coxa), adductors (adutores), abductors (abdutores), calves (panturrilhas). equipment: barbell (barra), dumbbell (halteres), machine (máquina), cable (polia), smith, kettlebell, bodyweight (peso corporal), band (elástico), other (outro). mechanics: compound (multiarticular) ou isolation (isolado).
3. Limites: 1–14 treinos; 1–30 exercícios por treino; sets (séries) 1–20; reps (repetições) 1–100; rir 0–5; rest (descanso) 0–900 segundos; sessionsPerWeek 1–14; loadWeeks 1–16; deloadWeeks 0–2; deloadVolumeFactor 0.3–1; deloadLoadFactor 0.5–1.
4. "reps" é uma faixa, como "8-12". O app usa dupla progressão: eu aumento as repetições dentro da faixa e o app sobe a carga quando todas as séries chegam ao topo da faixa; por isso sempre informe uma faixa (um número único, como "5", significa que a carga sobe sempre que todas as séries o atingirem).
5. "rir" é a meta de repetições na reserva e "rest" o descanso entre as séries, em segundos.
6. "startLoad" (kg) somente quando eu disser a carga que uso naquele exercício; caso contrário, omita.
7. "sessionsPerWeek" é o número de sessões que faço por semana; os treinos são feitos em rodízio.
8. "cycle": loadWeeks 8 para iniciante, 6 para intermediário, 4 para avançado, seguidas de 1 semana de deload, a menos que eu peça outra coisa.
9. Todas as cargas em quilogramas. Escreva nomes e observações em português.
10. Bi-sets: para que 2 a 4 exercícios seguidos sejam feitos sem descanso entre eles, dê a cada um o mesmo rótulo "superset", por exemplo "superset": "A". Caso contrário, omita.
11. Rampa de esforço (opcional): acrescente "rirRamp": { "start": 3, "end": 0 } dentro de "cycle" para que a meta de RIR caia semana a semana durante as semanas de carga. Use somente se eu pedir ou se combinar com a minha experiência.

12. Programas de força, powerlifting ou em porcentagem: quando eu pedir um, dê aos exercícios principais um esquema "percent" no lugar de "sets" e "reps" (omita "rir" e "startLoad" nesses exercícios). "weeks" lista as semanas em ordem, uma lista por semana; um esquema mais curto que o ciclo se repete. Cada semana é uma lista de grupos: "sets" é o número de séries idênticas, "reps" as repetições por série, "percent" a porcentagem do meu 1RM (1–120, de 0,5 em 0,5, escrita com ponto, como 77.5). Opcionais: "amrap": true para uma série com o máximo de repetições (reps é então o mínimo), "addKg" (−100 a 100) para somar ou subtrair quilos fixos, uma semana vazia [] para não fazer o exercício naquela semana. Opcionais em "percent": "of", o exercício cujo 1RM as porcentagens usam (padrão: o próprio exercício), e "startWeek", a semana do esquema na primeira semana de treino. Limites: 1–16 semanas, até 20 grupos e 40 séries por semana. Mantenha os acessórios em faixas de repetições, com "reps": "8-12".
13. "referenceMaxes" (opcional, até 50) é uma lista de objetos com "exercise" (um id da lista) e "kg" (por exemplo 140) com os meus 1RMs atuais. Inclua somente com valores que eu informei; nunca invente um 1RM.

LISTA DE EXERCÍCIOS (id — nome — músculo principal — equipamento)
{{EXERCISES}}
````

### 8.3 Using it (also described in the README)

1. Copy the prompt (from `docs/AI_PLAN_PROMPT.pt-BR.md` / `docs/AI_PLAN_PROMPT.md`, or from the app:
   Plan → New → Import → Create with AI).
2. Paste it as the first message of a new chat in any AI assistant, and add your information (goal,
   experience, days per week, equipment, limitations, current loads). The assistant asks for whatever
   is missing.
3. Copy the JSON answer (or save it as a `.json` file).
4. In the app: Plan → New → Import → paste the text or pick the file → review the preview (map or
   create any exercise the app does not know) → Save and activate.
