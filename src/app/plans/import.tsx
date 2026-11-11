import { useLocalSearchParams, useRouter } from 'expo-router';

import { PlanImportScreen } from '@/components/plan-import/plan-import-screen';

export default function PlanImportRoute() {
  const router = useRouter();
  const { update } = useLocalSearchParams<{ update?: string }>();
  const updateId = update === undefined ? NaN : Number(update);
  return (
    <PlanImportScreen
      updatePlanId={Number.isInteger(updateId) ? updateId : undefined}
      onBack={() => router.back()}
      onImported={(plan) => router.replace(`/plans/${plan.id}`)}
    />
  );
}
