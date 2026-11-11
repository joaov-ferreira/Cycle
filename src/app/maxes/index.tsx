import { useRouter } from 'expo-router';

import { useGoBack } from '@/components/navigation/use-go-back';
import { MaxesScreen } from '@/components/maxes/maxes-screen';

export default function MaxesRoute() {
  const router = useRouter();
  const goBack = useGoBack('/more');
  return (
    <MaxesScreen
      onBack={goBack}
      onOpenExercise={(exerciseId) => router.push({ pathname: '/maxes/[exerciseId]', params: { exerciseId } })}
      onOpenCalculator={() => router.push('/tools/one-rep-max')}
    />
  );
}
