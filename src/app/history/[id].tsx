import { useLocalSearchParams, useRouter } from 'expo-router';

import { HistoryDetailScreen } from '@/components/history/history-detail-screen';

export default function HistoryDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <HistoryDetailScreen
      workoutId={Number(id)}
      onBack={() => router.back()}
      onOpenExercise={(exerciseId) =>
        router.push({ pathname: '/exercises/[id]', params: { id: exerciseId } })
      }
      onDeleted={() => router.back()}
      onRepeated={() => router.navigate('/workout')}
    />
  );
}
