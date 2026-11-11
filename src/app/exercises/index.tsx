import { useRouter } from 'expo-router';

import { ExercisesScreen } from '@/components/exercises/exercises-screen';

export default function ExercisesRoute() {
  const router = useRouter();
  return (
    <ExercisesScreen
      onBack={() => router.back()}
      onOpenExercise={(id) => router.push({ pathname: '/exercises/[id]', params: { id } })}
      onNewExercise={(name) =>
        router.push(name ? { pathname: '/exercises/new', params: { name } } : '/exercises/new')
      }
    />
  );
}
