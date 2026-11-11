import { useLocalSearchParams, useRouter } from 'expo-router';

import { ProgressScreen } from '@/components/progress/progress-screen';

/** `(tabs)/progress`, optionally `?exerciseId=<id>` to open on one exercise (SPEC §9.1). */
export default function ProgressRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ exerciseId?: string | string[] }>();
  const exerciseId = Array.isArray(params.exerciseId) ? params.exerciseId[0] : params.exerciseId;
  return (
    <ProgressScreen
      initialExerciseId={exerciseId}
      onOpenExercise={(id) => router.push({ pathname: '/exercises/[id]', params: { id } })}
      onOpenWorkout={(id) => router.push({ pathname: '/history/[id]', params: { id: String(id) } })}
    />
  );
}
