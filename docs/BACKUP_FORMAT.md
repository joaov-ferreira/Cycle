# CYCLE backup format (`cycle-backup`, version 1)

A backup is one JSON file that holds everything of **one profile**: its settings, custom exercises,
exercise settings, plans (with their cycle state), workouts and body measurements. It is written by
**Settings → Data → Export backup** and read by **Restore backup**. The implementation is
`src/domain/backup.ts` (document, parser, summary, id remapping; pure) and the `BackupRepository`
of `src/data/` (export and restore in one transaction). The product rules are in
[SPEC-v3 §8](SPEC-v3.md).

Backups are for you: keeping a copy of your logbook, moving to another phone. They are **not** a way to
share plans — to share or exchange a plan use the [plan import format](IMPORT_FORMAT.md).

## 1. File

- Name: `cycle-backup-<profile>-<YYYYMMDD>.json`, where `<profile>` is the profile name in lowercase
  ASCII (accents removed, other characters replaced by `-`; `profile` when nothing is left) and the
  date is the local export date. Example: `cycle-backup-ana-20261120.json`.
- Content: UTF-8 JSON, pretty-printed with two spaces. Maximum size accepted on restore: 16 MiB.
- The export also stamps `settings.lastBackupAt` of the profile (the backup reminder of Home and Settings);
  the exported file holds the value from *before* that stamp.

## 2. Top-level properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `format` | `"cycle-backup"` | yes | Identifies the document. |
| `version` | `1` | yes | Format version (see §6). |
| `exportedAt` | string | yes | Export time, ISO 8601 UTC, e.g. `2026-11-20T10:00:00.000Z`. |
| `appVersion` | string | yes | Version of the app that wrote the file, e.g. `3.0.0`. |
| `profile` | object | yes | `{ "name": string }` — the profile the data belongs to. |
| `settings` | object | yes | The profile's settings (§3.1). |
| `customExercises` | array | yes | Custom exercises of the profile (§3.2). |
| `exerciseSettings` | array | no | Per-exercise increment, note and bar weight (§3.3). Absent = empty. |
| `plans` | array | yes | Every plan of the profile, archived ones included (§3.4). |
| `workouts` | array | yes | Completed workouts and the one in progress, if any (§3.5). |
| `bodyMetrics` | array | no | Body measurements (§3.6). Absent = empty. |

Unknown top-level properties are ignored.

## 3. Sections

### 3.1 `settings`

An object whose values are strings, numbers, booleans, `null` or arrays of numbers (anything else is
`invalidBackup`). The fields the app writes, all taken from the profile's settings:

| Field | Type | Meaning |
| --- | --- | --- |
| `language` | `"system"`, `"en"`, `"pt-BR"` | UI language setting. |
| `theme` | `"dark"`, `"light"` | Theme. |
| `onboardingCompleted` | boolean | Always `true` after a restore. |
| `experience` | `"beginner"`, `"intermediate"`, `"advanced"` | Sets the suggested cycle. |
| `defaultRestSeconds` | number | Default rest between sets, 0–600 s. |
| `restNotifications` | boolean | Notification when the rest ends. |
| `keepAwake` | boolean | Keep the screen on during a workout. |
| `barKg` | number | Default bar weight for the plate calculator. |
| `platesKg` | number[] | Available plates, heaviest first. |
| `lastBackupAt` | string or `null` | ISO time of the last backup. |

On restore each known field that is valid is kept; a missing or invalid one falls back to its default
and unknown keys are ignored. A restored profile never shows onboarding.

### 3.2 `customExercises[]`

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | The id in the source profile, `custom-<n>`. Used only to link plans, workouts and exercise settings; it is replaced on restore. |
| `name` | string | Name (stored in English; custom exercises have one name). |
| `primaryMuscle` | string | One of `chest`, `back`, `shoulders`, `traps`, `biceps`, `triceps`, `forearms`, `abs`, `lowerBack`, `glutes`, `quads`, `hamstrings`, `adductors`, `abductors`, `calves`. |
| `secondaryMuscles` | string[] | Same values. |
| `equipment` | string | `barbell`, `dumbbell`, `machine`, `cable`, `smith`, `kettlebell`, `bodyweight`, `band`, `other`. |
| `mechanics` | string | `compound` or `isolation`. |
| `archived` | boolean | Hidden from pickers but kept for history. |

### 3.3 `exerciseSettings[]`

One entry per exercise (built-in or custom id) that has at least one value.

| Field | Type | Description |
| --- | --- | --- |
| `exerciseId` | string | Built-in id (`barbell-bench-press`) or `custom-<n>`. |
| `incrementKg` | number | Load increment override for the progression. |
| `note` | string | Persistent exercise note, up to 200 characters. |
| `barKg` | number | Bar weight override for the plate calculator. |

### 3.4 `plans[]`

| Field | Type | Description |
| --- | --- | --- |
| `id` | number | Plan id in the source profile; replaced on restore. |
| `active` | boolean | `true` for the profile's active plan (at most one non-archived plan is restored as active). |
| `content` | object | The plan: `name`, `description`, `sessionsPerWeek`, `cycle`, `workouts` (below). |
| `cycleState` | object | Where the plan is in its cycle: `cycleNumber`, `phase` (`load` or `deload`), `week`, `sessionsDoneThisWeek`, `nextWorkoutIndex`. |
| `createdAt`, `updatedAt` | string | ISO times. |
| `archivedAt` | string or `null` | ISO time when archived. |

`content.cycle`: `loadWeeks`, `deloadWeeks`, `deloadVolumeFactor`, `deloadLoadFactor` and the optional
`rirRamp` (`{ "start": n, "end": n }` or `null`; the target RIR falls linearly over the load weeks).
`content.workouts[]`: `id`, `name`, `exercises[]`. Each plan exercise: `id`, `exerciseId`, `sets`,
`repMin`, `repMax` and optionally `targetRir`, `restSeconds`, `startLoadKg`, `note`, `supersetGroup`
(a label shared by 2–4 consecutive exercises).

This is the *internal* plan shape (ids, `repMin`/`repMax`), not the import format of
[IMPORT_FORMAT.md](IMPORT_FORMAT.md).

### 3.5 `workouts[]`

| Field | Type | Description |
| --- | --- | --- |
| `id` | number | Workout id in the source profile; replaced on restore. |
| `planId` | number or `null` | The plan it was started from (`null` for a free workout). |
| `planWorkoutId` | string or `null` | The plan workout (`w1`…) it was started from. |
| `name` | string | Name at the time. |
| `status` | `"completed"` or `"in_progress"` | |
| `phase` | `"load"` or `"deload"` | Phase of the cycle when it was started. |
| `cycleNumber`, `cycleWeek` | number or `null` | Cycle position when it was started. |
| `startedAt` | string | ISO time. |
| `completedAt` | string or `null` | ISO time; required for `completed`. |
| `notes` | string | Workout notes (absent = empty). |
| `exercises[]` | array | See below. |

Each workout exercise: `exerciseId`, `planExerciseId` (string or `null`), `target`
(`{ sets, repMin, repMax, targetRir?, restSeconds? }` snapshot of the plan row, or `null`), `note`
(session note), `supersetGroup` (string or `null`; absent in files written before superset support) and
`sets[]`. Each set: `kind` (`working`, `warmup` or `drop`), `weightKg`, `reps`, `rir` (numbers or
`null`) and `done` (boolean).

### 3.6 `bodyMetrics[]`

`{ "date": "YYYY-MM-DD", "kind": string, "value": number }` with `kind` one of `weight`, `bodyFat`,
`waist`, `chest`, `hips`, `arm`, `thigh`, `calf`. One value per day and kind; if the file holds
several, the last one wins. Values are validated with the limits of SPEC-v3 §9 on restore.

## 4. Restore (SPEC-v3 §8.1)

1. **Settings → Data → Restore backup** opens the file picker. The file is parsed (§5) and a summary is
   shown: profile name, export date, number of plans, workouts, custom exercises and body entries, first
   and last workout date.
2. On confirmation a **new profile** is created, named `<name> (restored)` (`<name> (restaurado)` in
   Portuguese; a counter is added when the name is taken, and the original name is shortened to keep
   the result within 40 characters).
3. **Nothing is overwritten.** Existing profiles, plans and workouts on the device are not touched; the
   app then switches to the new profile.
4. **Ids are remapped**: every custom exercise gets a new `custom-<n>` id and every plan a new id;
   plans, workouts and exercise settings that referenced the old ids are rewritten. Built-in exercise
   ids are kept as they are.
5. The plan flagged `active` (and not archived) becomes the profile's active plan; if none is flagged
   there is no active plan. At most one workout in progress is restored — the most recently started.
6. The whole restore runs in **one transaction**: if anything fails (an invalid set, a body value out of
   range…) nothing is left behind, not even the empty profile.

A backup restores into the app version that wrote it or a newer one; a file with a newer `version` is
refused (§6).

## 5. Errors

`parseBackup(text)` returns `{ ok: true, backup }` or `{ ok: false, errors }`, where each error is
`{ code, path? }`. The app shows a localized message for each code.

| Code | When | `path` |
| --- | --- | --- |
| `invalidJson` | The text is not valid JSON. | — |
| `notAnObject` | The JSON is not an object (an array, a number…). | — |
| `unsupportedFormat` | `format` is not `"cycle-backup"`. | `format` |
| `unsupportedVersion` | `version` is not `1`. | `version` |
| `invalidBackup` | A field is missing or has the wrong type or value. One error per broken section, with the path of the first bad value in it. | e.g. `plans[0].content.cycle.loadWeeks`, `workouts[2].exercises[0].sets[1].kind` |

Besides parsing, the restore itself can fail with a validation error of the data (for example a body
value out of range); the app then says that the backup could not be restored and nothing is changed.

## 6. Versioning

`version` is `1`. A change that older readers could not understand (a renamed or removed field, a
different meaning) raises it; adding optional properties does not. A reader refuses a version it does
not know (`unsupportedVersion`) instead of guessing. Fields that appeared after the first release of
the format (`supersetGroup`, `cycle.rirRamp`, set `kind` `drop`, `exerciseSettings.note`/`barKg`,
`bodyMetrics`) are optional on read, so files written by earlier builds still restore.

## 7. Example

A small backup (one plan with a superset and an effort ramp, one workout with a drop set, one body
weight, one exercise note):

```json
{
  "format": "cycle-backup",
  "version": 1,
  "exportedAt": "2026-11-20T10:00:00.000Z",
  "appVersion": "3.0.0",
  "profile": { "name": "Ana" },
  "settings": {
    "language": "pt-BR",
    "theme": "dark",
    "onboardingCompleted": true,
    "experience": "intermediate",
    "defaultRestSeconds": 90,
    "restNotifications": true,
    "keepAwake": true,
    "barKg": 20,
    "platesKg": [25, 20, 15, 10, 5, 2.5, 1.25],
    "lastBackupAt": null
  },
  "customExercises": [],
  "exerciseSettings": [
    { "exerciseId": "barbell-bench-press", "note": "Seat on position 4", "barKg": 15 }
  ],
  "plans": [
    {
      "id": 1,
      "active": true,
      "content": {
        "name": "Upper Lower",
        "description": "",
        "sessionsPerWeek": 2,
        "cycle": {
          "loadWeeks": 2,
          "deloadWeeks": 1,
          "deloadVolumeFactor": 0.5,
          "deloadLoadFactor": 0.9,
          "rirRamp": { "start": 2, "end": 0 }
        },
        "workouts": [
          {
            "id": "w1",
            "name": "A",
            "exercises": [
              { "id": "w1e1", "exerciseId": "barbell-bench-press", "sets": 3, "repMin": 8, "repMax": 12, "restSeconds": 120, "supersetGroup": "S1" },
              { "id": "w1e2", "exerciseId": "barbell-row", "sets": 3, "repMin": 8, "repMax": 12, "restSeconds": 90, "supersetGroup": "S1" }
            ]
          }
        ]
      },
      "cycleState": { "cycleNumber": 1, "phase": "load", "week": 1, "sessionsDoneThisWeek": 1, "nextWorkoutIndex": 0 },
      "createdAt": "2026-11-16T09:00:00.000Z",
      "updatedAt": "2026-11-16T09:00:00.000Z",
      "archivedAt": null
    }
  ],
  "workouts": [
    {
      "id": 1,
      "planId": 1,
      "planWorkoutId": "w1",
      "name": "A",
      "status": "completed",
      "phase": "load",
      "cycleNumber": 1,
      "cycleWeek": 1,
      "startedAt": "2026-11-16T09:05:00.000Z",
      "completedAt": "2026-11-16T09:55:00.000Z",
      "notes": "",
      "exercises": [
        {
          "exerciseId": "barbell-bench-press",
          "planExerciseId": "w1e1",
          "target": { "sets": 3, "repMin": 8, "repMax": 12, "targetRir": 2, "restSeconds": 120 },
          "note": "",
          "supersetGroup": "S1",
          "sets": [
            { "kind": "working", "weightKg": 40, "reps": 12, "rir": 2, "done": true },
            { "kind": "drop", "weightKg": 32.5, "reps": 8, "rir": null, "done": true }
          ]
        }
      ]
    }
  ],
  "bodyMetrics": [{ "date": "2026-11-16", "kind": "weight", "value": 80 }]
}
```

(Shortened: a real file lists every set of every exercise.)
