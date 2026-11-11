import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { PeriodizationScreen } from '@/components/plan/periodization-screen';

/** `/plans/<id>/periodization`: the cycle's weeks × the plan's workouts (SPEC-v4 §10.4). */
export default function PeriodizationRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <PeriodizationScreen
      planId={Number(id)}
      onBack={() => (router.canGoBack() ? router.back() : router.replace(`/plans/${id}` as Href))}
    />
  );
}
