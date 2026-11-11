import { useLocalSearchParams } from 'expo-router';

import { useGoBack } from '@/components/navigation/use-go-back';
import { MaxDetailScreen } from '@/components/maxes/max-detail-screen';

export default function MaxDetailRoute() {
  const goBack = useGoBack('/maxes');
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  return <MaxDetailScreen exerciseId={exerciseId} onBack={goBack} />;
}
