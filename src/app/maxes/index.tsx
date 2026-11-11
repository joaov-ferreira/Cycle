import { useRouter } from 'expo-router';

import { MaxesScreen } from '@/components/maxes/maxes-screen';

export default function MaxesRoute() {
  const router = useRouter();
  return (
    <MaxesScreen
      onBack={() => router.back()}
      onOpenExercise={(exerciseId) => router.push({ pathname: '/maxes/[exerciseId]', params: { exerciseId } })}
      onOpenCalculator={() => router.push('/tools/one-rep-max')}
    />
  );
}
