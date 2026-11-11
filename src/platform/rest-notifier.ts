import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { RestNotifier } from '@/state/types';

export type RestNotifierTexts = {
  title(): string;
  body(info: { exerciseId: string; setNumber: number }): string;
};

const CHANNEL_ID = 'rest';
const MIN_LEAD_MS = 1000;

/**
 * Local "rest over" notification (SPEC-v3 §1.2). Asks for permission the first time; a denial is
 * remembered for this run. One notification at a time; every failure is swallowed; no-op on web.
 * The in-app countdown covers the foreground, so foreground notifications are not shown.
 */
export function createRestNotifier(texts: RestNotifierTexts): RestNotifier {
  let scheduledId: string | null = null;
  let denied = false;
  let granted = false;
  let channelReady = false;

  if (Platform.OS !== 'web') {
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: false,
          shouldShowList: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
    } catch {
      // Best effort.
    }
  }

  async function ensurePermission(): Promise<boolean> {
    if (denied) return false;
    if (granted) return true;
    const current = await Notifications.getPermissionsAsync();
    const status = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (status.granted) {
      granted = true;
      return true;
    }
    denied = true;
    return false;
  }

  async function cancelCurrent(): Promise<void> {
    const id = scheduledId;
    scheduledId = null;
    if (id !== null) await Notifications.cancelScheduledNotificationAsync(id);
  }

  return {
    async scheduleRestEnd(atMs, info) {
      if (Platform.OS === 'web') return;
      try {
        await cancelCurrent();
        if (atMs - Date.now() <= MIN_LEAD_MS) return;
        if (!(await ensurePermission())) return;
        if (Platform.OS === 'android' && !channelReady) {
          await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
            name: texts.title(),
            // eslint-disable-next-line import/namespace -- re-exported through `export *`
            importance: Notifications.AndroidImportance.HIGH,
          });
          channelReady = true;
        }
        scheduledId = await Notifications.scheduleNotificationAsync({
          content: { title: texts.title(), body: texts.body(info) },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: atMs,
            channelId: CHANNEL_ID,
          },
        });
      } catch {
        // Notifications are best effort: the in-app countdown still works.
      }
    },
    async cancelRestEnd() {
      if (Platform.OS === 'web') return;
      try {
        await cancelCurrent();
      } catch {
        // Best effort.
      }
    },
  };
}
