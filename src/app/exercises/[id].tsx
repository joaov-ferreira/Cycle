import { useLocalSearchParams, useRouter } from 'expo-router';

import { ExerciseDetailScreen } from '@/components/exercises/exercise-detail-screen';

export default function ExerciseDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ExerciseDetailScreen
      exerciseId={id}
      onBack={() => router.back()}
      onOpenProgress={(exerciseId) =>
        router.push({ pathname: '/(tabs)/progress', params: { exerciseId } })
      }
      onOpenWorkout={(workoutId) =>
        router.push({ pathname: '/history/[id]', params: { id: String(workoutId) } })
      }
      onOpenExercise={(id) => router.push({ pathname: '/exercises/[id]', params: { id } })}
    />
  );
}
