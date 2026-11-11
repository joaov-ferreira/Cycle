import { useLocalSearchParams, useRouter } from 'expo-router';

import { CycleReportScreen } from '@/components/cycle-report/cycle-report-screen';

export default function CycleReportRoute() {
  const router = useRouter();
  const { id, cycle } = useLocalSearchParams<{ id: string; cycle: string }>();
  return (
    <CycleReportScreen
      planId={Number(id)}
      cycleNumber={Number(cycle)}
      onBack={() => router.back()}
      onReviewWithAi={(planId) => router.push(`/plans/${planId}/review`)}
      onOpenExercise={(exerciseId) => router.push(`/exercises/${exerciseId}`)}
    />
  );
}
