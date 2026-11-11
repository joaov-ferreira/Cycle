import { useRouter, type Href } from 'expo-router';

import { PlanListScreen } from '@/components/plan/plan-list-screen';

export default function PlanListRoute() {
  const router = useRouter();
  return (
    <PlanListScreen
      onOpenPlan={(id) => router.push(`/plans/${id}` as Href)}
      onNewPlan={() => router.push('/plans/new')}
      onBack={() => router.back()}
    />
  );
}
