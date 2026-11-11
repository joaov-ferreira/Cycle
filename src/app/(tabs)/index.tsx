import { useRouter, type Href } from 'expo-router';

import { HomeScreen, type NewPlanKind } from '@/components/home/home-screen';

const NEW_PLAN_ROUTES: Record<NewPlanKind, Href> = {
  templates: '/plans/templates',
  import: '/plans/import',
  scratch: '/plans/scratch/edit',
};

export default function HomeRoute() {
  const router = useRouter();
  return (
    <HomeScreen
      onOpenWorkout={() => router.navigate('/workout')}
      onOpenWorkoutDetail={(id) => router.push(`/history/${id}` as Href)}
      onNewPlan={(kind) => router.push(NEW_PLAN_ROUTES[kind])}
      onOpenPlan={() => router.navigate('/plan')}
    />
  );
}
