import { useRouter, type Href } from 'expo-router';

import { PlanScreen } from '@/components/plan/plan-screen';

export default function PlanRoute() {
  const router = useRouter();
  return (
    <PlanScreen
      onNewPlan={() => router.push('/plans/new')}
      onOpenPlans={() => router.push('/plans')}
      onEditPlan={(id) => router.push(`/plans/${id}/edit` as Href)}
      onExportPlan={(id) => router.push(`/plans/${id}/export` as Href)}
      onReviewWithAi={(id) => router.push(`/plans/${id}/review` as Href)}
      onOpenCycle={(id, cycle) => router.push(`/plans/${id}/cycles/${cycle}` as Href)}
    />
  );
}
