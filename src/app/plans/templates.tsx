import { useRouter } from 'expo-router';

import { PlanTemplatesScreen } from '@/components/plan-import/plan-templates-screen';

export default function PlanTemplatesRoute() {
  const router = useRouter();
  return (
    <PlanTemplatesScreen
      onBack={() => router.back()}
      onCreated={(plan) => router.replace(`/plans/${plan.id}`)}
    />
  );
}
