import { useLocalSearchParams, type Href } from 'expo-router';

import { useGoBack } from '@/components/navigation/use-go-back';
import { PeriodizationScreen } from '@/components/plan/periodization-screen';

/** `/plans/<id>/periodization`: the cycle's weeks × the plan's workouts (SPEC-v4 §10.4). */
export default function PeriodizationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const goBack = useGoBack(`/plans/${id}` as Href);
  return <PeriodizationScreen planId={Number(id)} onBack={goBack} />;
}
