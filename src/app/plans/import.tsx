import { useRouter } from 'expo-router';

import { PlanImportScreen } from '@/components/plan-import/plan-import-screen';

export default function PlanImportRoute() {
  const router = useRouter();
  return (
    <PlanImportScreen
      onBack={() => router.back()}
      onImported={(plan) => router.replace(`/plans/${plan.id}`)}
    />
  );
}
