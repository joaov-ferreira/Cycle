import { useEffect, useRef } from 'react';

import { exerciseName } from '@/components/shared/labels';
import { useI18n } from '@/i18n';
import { selectFindExercise } from '@/state/selectors';
import { useAppStore } from '@/state/app-store-context';
import type { RestNotifier } from '@/state/types';

import { createRestNotifier, type RestNotifierTexts } from './rest-notifier';

/**
 * A rest notifier whose texts follow the app language. The notifier is created once (outside
 * React) and reads its texts from a holder that `<RestNotifierTexts />`, rendered inside the
 * providers, keeps current: language and exercise lookup are resolved when a notification is
 * scheduled.
 */
export function createLocalizedRestNotifier(): {
  notifier: RestNotifier;
  /** Render once inside the providers. */
  TextsBinder: () => null;
} {
  const holder: { current: RestNotifierTexts | null } = { current: null };
  const fallback: RestNotifierTexts = { title: () => 'Rest over', body: () => '' };
  const notifier = createRestNotifier({
    title: () => (holder.current ?? fallback).title(),
    body: (info) => (holder.current ?? fallback).body(info),
  });

  function TextsBinder() {
    const { t, locale } = useI18n();
    const find = useAppStore(selectFindExercise);
    const latest = useRef<RestNotifierTexts | null>(null);
    latest.current = {
      title: () => t('settings.notification.title'),
      body: ({ exerciseId, setNumber }) => {
        const exercise = find(exerciseId);
        return t('settings.notification.body', {
          exercise: exercise ? exerciseName(exercise, locale) : exerciseId,
          set: setNumber,
        });
      },
    };
    useEffect(() => {
      holder.current = latest.current;
      return () => {
        holder.current = null;
      };
    });
    return null;
  }

  return { notifier, TextsBinder };
}
