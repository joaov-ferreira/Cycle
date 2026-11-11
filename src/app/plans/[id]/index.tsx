import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { PlanDetailScreen } from '@/components/plan/plan-detail-screen';

export default function PlanDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <PlanDetailScreen
      planId={Number(id)}
      onBack={() => router.back()}
      onEditPlan={(planId) => router.push(`/plans/${planId}/edit` as Href)}
      onExportPlan={(planId) => router.push(`/plans/${planId}/export` as Href)}
      onDeleted={() => router.back()}
      onOpenPlan={(planId) => router.push(`/plans/${planId}` as Href)}
    />
  );
}
