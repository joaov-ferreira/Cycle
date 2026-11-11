import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { createRestNotifier } from './rest-notifier';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const mocked = Notifications as unknown as Record<string, jest.Mock>;
const NOW = 1_000_000;
const info = { exerciseId: 'barbell-bench-press', setNumber: 2 };
const texts = { title: () => 'Rest over', body: (i: { setNumber: number }) => `set ${i.setNumber}` };

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  mocked.getPermissionsAsync.mockResolvedValue({ granted: false });
  mocked.requestPermissionsAsync.mockResolvedValue({ granted: true });
  let n = 0;
  mocked.scheduleNotificationAsync.mockImplementation(async () => `id-${++n}`);
  (Platform as { OS: string }).OS = 'ios';
});

afterEach(() => jest.restoreAllMocks());

describe('createRestNotifier', () => {
  it('asks for permission once and schedules one local notification at the given time', async () => {
    const notifier = createRestNotifier(texts);
    await notifier.scheduleRestEnd(NOW + 90_000, info);
    await notifier.scheduleRestEnd(NOW + 60_000, info);
    expect(mocked.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: { title: 'Rest over', body: 'set 2' },
      trigger: { type: 'date', date: NOW + 90_000, channelId: 'rest' },
    });
  });

  it('does not ask when the permission is already granted', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ granted: true });
    await createRestNotifier(texts).scheduleRestEnd(NOW + 90_000, info);
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('remembers a denial: nothing scheduled and no further prompt', async () => {
    mocked.requestPermissionsAsync.mockResolvedValue({ granted: false });
    const notifier = createRestNotifier(texts);
    await notifier.scheduleRestEnd(NOW + 90_000, info);
    await notifier.scheduleRestEnd(NOW + 90_000, info);
    expect(mocked.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('cancels the previously scheduled notification before scheduling a new one', async () => {
    const notifier = createRestNotifier(texts);
    await notifier.scheduleRestEnd(NOW + 90_000, info);
    await notifier.scheduleRestEnd(NOW + 120_000, info);
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith('id-1');
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it('ignores a time in the past or within the next second, still cancelling the old one', async () => {
    const notifier = createRestNotifier(texts);
    await notifier.scheduleRestEnd(NOW + 90_000, info);
    await notifier.scheduleRestEnd(NOW - 5_000, info);
    await notifier.scheduleRestEnd(NOW + 1_000, info);
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('cancels on cancelRestEnd, once', async () => {
    const notifier = createRestNotifier(texts);
    await notifier.scheduleRestEnd(NOW + 90_000, info);
    await notifier.cancelRestEnd();
    await notifier.cancelRestEnd();
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('creates the Android channel once', async () => {
    (Platform as { OS: string }).OS = 'android';
    const notifier = createRestNotifier(texts);
    await notifier.scheduleRestEnd(NOW + 90_000, info);
    await notifier.scheduleRestEnd(NOW + 95_000, info);
    expect(mocked.setNotificationChannelAsync).toHaveBeenCalledTimes(1);
    expect(mocked.setNotificationChannelAsync).toHaveBeenCalledWith('rest', { name: 'Rest over', importance: 4 });
  });

  it('swallows every failure', async () => {
    const notifier = createRestNotifier(texts);
    mocked.getPermissionsAsync.mockRejectedValue(new Error('boom'));
    await expect(notifier.scheduleRestEnd(NOW + 90_000, info)).resolves.toBeUndefined();
    mocked.getPermissionsAsync.mockResolvedValue({ granted: true });
    mocked.scheduleNotificationAsync.mockRejectedValue(new Error('boom'));
    await expect(notifier.scheduleRestEnd(NOW + 90_000, info)).resolves.toBeUndefined();
    mocked.scheduleNotificationAsync.mockResolvedValue('id-x');
    await notifier.scheduleRestEnd(NOW + 90_000, info);
    mocked.cancelScheduledNotificationAsync.mockRejectedValue(new Error('boom'));
    await expect(notifier.cancelRestEnd()).resolves.toBeUndefined();
  });

  it('is a no-op on web', async () => {
    (Platform as { OS: string }).OS = 'web';
    const notifier = createRestNotifier(texts);
    await notifier.scheduleRestEnd(NOW + 90_000, info);
    await notifier.cancelRestEnd();
    expect(mocked.getPermissionsAsync).not.toHaveBeenCalled();
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocked.setNotificationHandler).not.toHaveBeenCalled();
  });

  it('does not let a failing handler setup break creation', () => {
    mocked.setNotificationHandler.mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => createRestNotifier(texts)).not.toThrow();
  });
});
