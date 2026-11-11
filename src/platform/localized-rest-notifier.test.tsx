import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { Platform, Text } from 'react-native';

import { renderInApp } from '@/test-utils/render-app';
import { SettingsScreen } from '@/components/settings/settings-screen';

import { createLocalizedRestNotifier } from './localized-rest-notifier';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('id')),
  cancelScheduledNotificationAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const schedule = Notifications.scheduleNotificationAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (Platform as { OS: string }).OS = 'ios';
});

describe('createLocalizedRestNotifier', () => {
  it('uses the app language chosen in Settings and the exercise name in that language', async () => {
    const { notifier, TextsBinder } = createLocalizedRestNotifier();
    await renderInApp(
      <>
        <TextsBinder />
        <SettingsScreen />
        <Text>ready</Text>
      </>,
      { language: 'en', notifier },
    );
    const atMs = Date.now() + 60_000;
    await notifier.scheduleRestEnd(atMs, { exerciseId: 'barbell-bench-press', setNumber: 3 });
    expect(schedule).toHaveBeenLastCalledWith(
      expect.objectContaining({ content: { title: 'Rest over', body: 'Next: Barbell Bench Press — set 3' } }),
    );

    await fireEvent.press(await screen.findByRole('button', { name: 'Português' }));
    await screen.findByRole('header', { name: 'Configurações' });
    await act(async () => {
      await notifier.scheduleRestEnd(atMs, { exerciseId: 'barbell-bench-press', setNumber: 1 });
    });
    const content = schedule.mock.calls[schedule.mock.calls.length - 1][0].content;
    expect(content.title).toBe('Descanso terminado');
    expect(content.body).toMatch(/^Próximo: .+ — série 1$/);
    expect(content.body).not.toContain('Barbell Bench Press');
  });

  it('falls back to the exercise id for an unknown exercise', async () => {
    const { notifier, TextsBinder } = createLocalizedRestNotifier();
    await renderInApp(<TextsBinder />, { notifier });
    await notifier.scheduleRestEnd(Date.now() + 60_000, { exerciseId: 'gone', setNumber: 2 });
    expect(schedule.mock.calls[0][0].content.body).toBe('Next: gone — set 2');
  });

  it('has English text before the binder is mounted', async () => {
    const { notifier } = createLocalizedRestNotifier();
    await notifier.scheduleRestEnd(Date.now() + 60_000, { exerciseId: 'x', setNumber: 1 });
    expect(schedule.mock.calls[0][0].content.title).toBe('Rest over');
  });
});
