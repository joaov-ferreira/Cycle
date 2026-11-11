import { useRouter } from 'expo-router';

import { WorkoutScreen } from '@/components/workout/workout-screen';

export default function WorkoutRoute() {
  const router = useRouter();
  return (
    <WorkoutScreen
      onNewPlan={() => router.push('/plans/new')}
      onOpenWorkoutDetail={(id) => router.push(`/history/${id}`)}
    />
  );
}
