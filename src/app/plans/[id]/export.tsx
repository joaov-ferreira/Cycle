import { useLocalSearchParams, useRouter } from 'expo-router';

import { PlanExportScreen } from '@/components/plan-import/plan-export-screen';

export default function PlanExportRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlanExportScreen planId={Number(id)} onBack={() => router.back()} />;
}
