import { Linking, Share, Vibration } from 'react-native';

import { useAppStore } from '@/state';

import { WorkoutLogger } from './logger-view';
import { WorkoutStart } from './start-view';
import { WorkoutSummary } from './summary-view';

export type WorkoutScreenProps = {
  /** The user wants to create a plan (no active plan). */
  onNewPlan: () => void;
  /** Opens the history detail of a workout (from the summary). */
  onOpenWorkoutDetail: (id: number) => void;
  /** Current time in epoch milliseconds, for the rest countdown. Default `Date.now`. */
  now?: () => number;
  /** Vibrates with a pattern. Default React Native's `Vibration.vibrate`. */
  vibrate?: (pattern: number[]) => void;
  /** Shares text through the system share sheet; never rejects. Default `Share.share`. */
  share?: (text: string) => Promise<void>;
  /** Opens a link in the browser. Default `Linking.openURL`. */
  openUrl?: (url: string) => void;
};

const defaultNow = () => Date.now();
const defaultVibrate = (pattern: number[]) => Vibration.vibrate(pattern);
const defaultShare = async (text: string) => {
  try {
    await Share.share({ message: text });
  } catch {
    // The share sheet failing (or being unavailable) is not worth an error screen.
  }
};
const defaultOpenUrl = (url: string) => {
  void Linking.openURL(url).catch(() => undefined);
};

/**
 * Workout tab (SPEC §7): the workout in progress when there is one, else the summary of the one
 * just finished, else the start view.
 */
export function WorkoutScreen({
  onNewPlan,
  onOpenWorkoutDetail,
  now = defaultNow,
  vibrate = defaultVibrate,
  share = defaultShare,
  openUrl = defaultOpenUrl,
}: WorkoutScreenProps) {
  const current = useAppStore((s) => s.currentWorkout);
  const lastFinish = useAppStore((s) => s.lastFinish);

  if (current) return <WorkoutLogger workout={current} now={now} vibrate={vibrate} openUrl={openUrl} />;
  if (lastFinish) {
    return <WorkoutSummary result={lastFinish} onOpenWorkoutDetail={onOpenWorkoutDetail} share={share} />;
  }
  return <WorkoutStart onNewPlan={onNewPlan} />;
}
