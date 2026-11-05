import { useRouter } from 'expo-router';

import { TrainingScreen } from '@/components/performance/training-screen';

export default function TrainingRoute() {
  const router = useRouter();
  return <TrainingScreen onOpenSession={(id) => router.push({ pathname: '/session/[id]', params: { id } })} />;
}
