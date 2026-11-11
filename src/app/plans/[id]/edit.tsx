import { useLocalSearchParams, useRouter } from 'expo-router';

import { PlanEditScreen } from '@/components/plan/plan-edit-screen';

/** `/plans/<id>/edit` edits a plan; `/plans/scratch/edit` creates a new one. */
export default function PlanEditRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const planId = id === 'scratch' ? null : Number(id);
  return (
    <PlanEditScreen
      planId={planId}
      onSaved={(plan) => router.replace({ pathname: '/plans/[id]', params: { id: String(plan.id) } })}
      onCancel={() => (router.canGoBack() ? router.back() : router.replace('/plans'))}
    />
  );
}
