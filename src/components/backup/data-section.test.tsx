import { fireEvent, screen } from '@testing-library/react-native';

import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import { parseBackup } from '@/domain/backup';
import { createClock, DAY_MS } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import { createTestStore, seedCompletedWorkout, seedPlan } from '@/test-utils/seed';

import { SettingsScreen } from '../settings/settings-screen';

/** A store with one plan and one completed workout, plus the text of its backup. */
async function seededBackup(profileName = 'Ana') {
  const clock = createClock();
  const repos = createMemoryRepositories({ clock });
  const { store } = await createTestStore({ clock, repos, profileName, appVersion: '3.0.0' });
  await seedPlan(store);
  await seedCompletedWorkout(store);
  const file = await store.getState().buildBackupFile();
  return { clock, file };
}

const picked = (text: string) => async () => ({ name: 'backup.json', text, size: text.length });

describe('Settings → Data: export', () => {
  it('shows "No backup yet", exports a backup file and then marks the backup', async () => {
    const clock = createClock();
    const repos = createMemoryRepositories({ clock });
    const { store } = await createTestStore({ clock, repos });
    await seedPlan(store);
    await seedCompletedWorkout(store);
    const saveFile = jest.fn().mockResolvedValue(true);
    await renderInApp(<SettingsScreen saveFile={saveFile} now={clock} />, { store, repos });

    expect(await screen.findByText('No backup yet')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Export backup' }));

    expect(await screen.findByText('Backup exported.')).toBeOnTheScreen();
    expect(saveFile).toHaveBeenCalledTimes(1);
    const file = saveFile.mock.calls[0][0];
    expect(file.fileName).toMatch(/^cycle-backup-default-\d{8}\.json$/);
    expect(file.mimeType).toBe('application/json');
    expect(parseBackup(file.text).ok).toBe(true);
    expect(screen.queryByText('No backup yet')).toBeNull();
    expect(screen.getByText(/^Last backup: /)).toBeOnTheScreen();
    expect(store.getState().settings?.lastBackupAt).not.toBeNull();
  });

  it('does not mark the backup when saving fails', async () => {
    const saveFile = jest.fn().mockResolvedValue(false);
    const { store } = await renderInApp(<SettingsScreen saveFile={saveFile} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Export backup' }));
    expect(await screen.findByText('The backup could not be saved or shared.')).toBeOnTheScreen();
    expect(screen.getByText('No backup yet')).toBeOnTheScreen();
    expect(store.getState().settings?.lastBackupAt).toBeNull();
  });

  it('survives a saveFile that throws', async () => {
    const saveFile = jest.fn().mockRejectedValue(new Error('boom'));
    await renderInApp(<SettingsScreen saveFile={saveFile} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Export backup' }));
    expect(await screen.findByText('The backup could not be saved or shared.')).toBeOnTheScreen();
  });

  it('shows the reminder after 31 days without a backup and hides it with a recent one', async () => {
    const clock = createClock();
    const repos = createMemoryRepositories({ clock });
    const { store } = await createTestStore({ clock, repos });
    await seedPlan(store);
    await seedCompletedWorkout(store);
    await store.getState().markBackupDone();
    clock.advance(31 * DAY_MS);
    await renderInApp(<SettingsScreen now={clock} />, { store, repos });
    expect(await screen.findByText(/It has been a while since your last backup/)).toBeOnTheScreen();
  });

  it('shows no reminder without workouts or right after a backup', async () => {
    const clock = createClock();
    const repos = createMemoryRepositories({ clock });
    const { store } = await createTestStore({ clock, repos });
    await renderInApp(<SettingsScreen now={clock} />, { store, repos });
    expect(await screen.findByText('No backup yet')).toBeOnTheScreen();
    expect(screen.queryByText(/It has been a while/)).toBeNull();
  });
});

describe('Settings → Data: CSV', () => {
  it('is disabled with a hint without a completed workout', async () => {
    const saveFile = jest.fn();
    await renderInApp(<SettingsScreen saveFile={saveFile} />);
    const button = await screen.findByRole('button', { name: 'Export logbook (CSV)' });
    expect(button).toBeDisabled();
    expect(screen.getByText('Complete a workout to export your logbook.')).toBeOnTheScreen();
    await fireEvent.press(button);
    expect(saveFile).not.toHaveBeenCalled();
  });

  it('exports the logbook as text/csv', async () => {
    const clock = createClock();
    const repos = createMemoryRepositories({ clock });
    const { store } = await createTestStore({ clock, repos });
    await seedPlan(store);
    await seedCompletedWorkout(store);
    const saveFile = jest.fn().mockResolvedValue(true);
    await renderInApp(<SettingsScreen saveFile={saveFile} />, { store, repos });
    await fireEvent.press(await screen.findByRole('button', { name: 'Export logbook (CSV)' }));
    expect(await screen.findByText('Logbook exported.')).toBeOnTheScreen();
    const file = saveFile.mock.calls[0][0];
    expect(file.mimeType).toBe('text/csv');
    expect(file.fileName).toMatch(/\.csv$/);
    expect(file.text.split(/\r?\n/)[0]).toBe('date,workout,plan,phase,exercise_id,exercise,set,kind,weight_kg,reps,rir');
    expect(file.text).toContain('barbell-bench-press');
  });

  it('reports a failed CSV export', async () => {
    const clock = createClock();
    const repos = createMemoryRepositories({ clock });
    const { store } = await createTestStore({ clock, repos });
    await seedPlan(store);
    await seedCompletedWorkout(store);
    const saveFile = jest.fn().mockResolvedValue(false);
    await renderInApp(<SettingsScreen saveFile={saveFile} />, { store, repos });
    await fireEvent.press(await screen.findByRole('button', { name: 'Export logbook (CSV)' }));
    expect(await screen.findByText('The logbook could not be saved or shared.')).toBeOnTheScreen();
  });
});

describe('Settings → Data: restore', () => {
  it('previews a real backup, then restores it into a new, uniquely named profile', async () => {
    const { file } = await seededBackup('Ana');
    const { repos, store } = await renderInApp(<SettingsScreen pickFile={picked(file.text)} />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Restore backup' }));
    expect(await screen.findByText('Restore this backup?')).toBeOnTheScreen();
    expect(screen.getByText('Profile: Ana')).toBeOnTheScreen();
    expect(screen.getByText('Plans: 1')).toBeOnTheScreen();
    expect(screen.getByText('Workouts: 1')).toBeOnTheScreen();
    expect(screen.getByText('Custom exercises: 0')).toBeOnTheScreen();
    expect(screen.getByText('Body entries: 0')).toBeOnTheScreen();
    expect(screen.getByText(/^First workout: /)).toBeOnTheScreen();
    expect(screen.getByText(/^Last workout: /)).toBeOnTheScreen();
    expect(
      screen.getByText('A new profile will be created and nothing on this device is overwritten.'),
    ).toBeOnTheScreen();
    expect(await repos.profiles.list()).toHaveLength(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Restore' }));
    expect(await screen.findByText('Restored. You are now using the profile "Ana (restored)".')).toBeOnTheScreen();
    expect(store.getState().profile?.name).toBe('Ana (restored)');
    expect(store.getState().workouts).toHaveLength(1);
    expect(await repos.profiles.list()).toHaveLength(2);
    expect(screen.queryByText('Restore this backup?')).toBeNull();
  });

  it('makes the restored name unique on a second restore and cuts it to 40 characters', async () => {
    const { file } = await seededBackup('Ana');
    const { store } = await renderInApp(<SettingsScreen pickFile={picked(file.text)} />);
    for (let i = 0; i < 2; i++) {
      await fireEvent.press(await screen.findByRole('button', { name: 'Restore backup' }));
      await fireEvent.press(await screen.findByRole('button', { name: 'Restore' }));
      await screen.findByText(/^Restored\. You are now using/);
    }
    expect(store.getState().profile?.name).toBe('Ana (restored) 2');

    const long = await seededBackup('y'.repeat(50));
    const second = await renderInApp(<SettingsScreen pickFile={picked(long.file.text)} />);
    await fireEvent.press(await screen.findAllByRole('button', { name: 'Restore backup' }).then((b) => b[b.length - 1]));
    await fireEvent.press(await screen.findByRole('button', { name: 'Restore' }));
    await screen.findByText(/^Restored\. You are now using/);
    expect(second.store.getState().profile?.name).toBe(`${'y'.repeat(29)} (restored)`);
  });

  it('can be cancelled without changing anything', async () => {
    const { file } = await seededBackup();
    const { repos } = await renderInApp(<SettingsScreen pickFile={picked(file.text)} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Restore backup' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Restore this backup?')).toBeNull();
    expect(await repos.profiles.list()).toHaveLength(1);
  });

  it('does nothing when the picker is cancelled', async () => {
    await renderInApp(<SettingsScreen pickFile={async () => null} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Restore backup' }));
    expect(screen.queryByText('Restore this backup?')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('rejects a file that is too large', async () => {
    await renderInApp(
      <SettingsScreen pickFile={async () => ({ name: 'x.json', text: '', size: 100 * 1024 * 1024 })} />,
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Restore backup' }));
    expect(await screen.findByText('This file is too large to be a backup.')).toBeOnTheScreen();
  });

  it('shows a generic message when picking fails', async () => {
    await renderInApp(
      <SettingsScreen
        pickFile={async () => {
          throw new Error('picker');
        }}
      />,
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Restore backup' }));
    expect(await screen.findByText('The backup could not be restored.')).toBeOnTheScreen();
  });

  const messages: [string, string, string][] = [
    ['not json', '{oops', 'The file is not valid JSON.'],
    ['an array', '[1]', 'The file does not contain a backup.'],
    ['another format', JSON.stringify({ format: 'other', version: 1 }), 'This is not a CYCLE backup file.'],
    [
      'a newer version',
      JSON.stringify({ format: 'cycle-backup', version: 99 }),
      'This backup was made by a newer version of the app. Update the app and try again.',
    ],
  ];
  it.each(messages)('explains a broken file: %s', async (_name, text, message) => {
    const { repos } = await renderInApp(<SettingsScreen pickFile={picked(text)} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Restore backup' }));
    expect(await screen.findByText(message)).toBeOnTheScreen();
    expect(await repos.profiles.list()).toHaveLength(1);
  });

  it('names the failing path of a damaged backup, in both languages', async () => {
    const { file } = await seededBackup();
    const doc = JSON.parse(file.text);
    doc.workouts = 'nope';
    const text = JSON.stringify(doc);
    await renderInApp(<SettingsScreen pickFile={picked(text)} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Restore backup' }));
    expect(await screen.findByText('The backup is damaged or incomplete (problem at workouts).')).toBeOnTheScreen();
    screen.unmount();

    await renderInApp(<SettingsScreen pickFile={picked(text)} />, { language: 'pt-BR' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Restaurar backup' }));
    expect(await screen.findByText('O backup está danificado ou incompleto (problema em workouts).')).toBeOnTheScreen();
  });

  it('reports a restore that fails after the preview', async () => {
    const { file } = await seededBackup();
    const { store } = await renderInApp(<SettingsScreen pickFile={picked(file.text)} />);
    const { InvalidProfileNameError, BackupParseError } = jest.requireActual('@/state/errors');
    await fireEvent.press(await screen.findByRole('button', { name: 'Restore backup' }));
    const confirm = await screen.findByRole('button', { name: 'Restore' });

    const { act } = jest.requireActual('@testing-library/react-native');
    await act(async () => {
      store.setState({ restoreBackup: () => Promise.reject(new InvalidProfileNameError('tooLong')) });
    });
    await fireEvent.press(confirm);
    expect(await screen.findByText('The profile name for the restored data is not valid.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Restore backup' }));
    await act(async () => {
      store.setState({ restoreBackup: () => Promise.reject(new BackupParseError([{ code: 'invalidJson' }])) });
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Restore' }));
    expect(await screen.findByText('The file is not valid JSON.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Restore backup' }));
    await act(async () => {
      store.setState({ restoreBackup: () => Promise.reject(new Error('db')) });
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Restore' }));
    expect(await screen.findByText('The backup could not be restored.')).toBeOnTheScreen();
  });

  it('is available in Portuguese: restored name and confirmation', async () => {
    const { file } = await seededBackup('Ana');
    const { store } = await renderInApp(<SettingsScreen pickFile={picked(file.text)} />, { language: 'pt-BR' });
    expect(await screen.findByRole('header', { name: 'Dados' })).toBeOnTheScreen();
    expect(screen.getByText('Nenhum backup ainda')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Restaurar backup' }));
    expect(await screen.findByText('Restaurar este backup?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByText('Restaurado. Você agora está usando o perfil "Ana (restaurado)".')).toBeOnTheScreen();
    expect(store.getState().profile?.name).toBe('Ana (restaurado)');
  });
});
