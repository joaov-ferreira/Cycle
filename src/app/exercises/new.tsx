import { useLocalSearchParams, useRouter } from 'expo-router';

import { ExerciseNewScreen } from '@/components/exercises/exercise-new-screen';

export default function ExerciseNewRoute() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name?: string }>();
  return (
    <ExerciseNewScreen
      initialName={name}
      onCancel={() => router.back()}
      onCreated={(exercise) =>
        router.replace({ pathname: '/exercises/[id]', params: { id: exercise.id } })
      }
    />
  );
}
