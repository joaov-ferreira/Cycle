import { useLocalSearchParams, useRouter } from 'expo-router';

import { MaxDetailScreen } from '@/components/maxes/max-detail-screen';

export default function MaxDetailRoute() {
  const router = useRouter();
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  return <MaxDetailScreen exerciseId={exerciseId} onBack={() => router.back()} />;
}
