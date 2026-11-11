# `src/platform/` — adapters for native modules

The only place that talks to device features. Everything here is a thin adapter: the store and the screens
get the capability through a small interface or a prop, and tests replace it with a fake, so the rest of the
app never imports an Expo native module.

- `rest-notifier.ts` — `createRestNotifier(texts)`: the `RestNotifier` port of `src/state/types.ts` on top
  of `expo-notifications` (a local "rest over" notification at the end of the rest, one at a time, permission
  asked the first time, every failure swallowed, no-op on web). `localized-rest-notifier.tsx` creates it once
  outside React and a `TextsBinder` inside the providers keeps its texts in the app language.
- `keep-awake.tsx` — `KeepAwakeWhileLogging`: `expo-keep-awake` while the Workout tab is shown, a workout is in
  progress and the "Keep screen on" setting is on.
- `save-file.ts` — `saveAndShareFile({ fileName, text, mimeType })`: writes a file to the cache directory and
  opens the share sheet (`expo-file-system`, `expo-sharing`), or downloads it on the web. Resolves `false`,
  never throws. Used for backups and the CSV.
- `pick-backup-file.ts` — `pickBackupFile()`: `expo-document-picker` + `expo-file-system`, up to 16 MiB.
  (The plan import has its own picker in `components/plan-import/` with a 256 KiB limit.)
- `app-version.ts` — `getAppVersion()`: the version written into backups.

Rules:

- May import Expo/React Native modules and `src/state/` types; screens receive these adapters as props with
  the adapter as the default (`WorkoutScreen` takes `now`, `vibrate`, `share`; `SettingsScreen` takes
  `saveFile`, `pickFile`, `now`), and `src/app/_layout.tsx` wires the notifier and the keep-awake component.
- Every adapter fails soft: a missing permission, an unavailable share sheet or a thrown error must never break
  logging a set.
- Tests use fakes (`createFakeNotifier` in `src/test-utils/seed.ts`, jest mocks of the Expo modules). What a real
  device does (notifications, keep-awake, the share sheet) is not covered by automated tests.
