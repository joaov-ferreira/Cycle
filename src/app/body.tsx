import { useRouter } from 'expo-router';

import { BodyScreen } from '@/components/body/body-screen';

export default function BodyRoute() {
  const router = useRouter();
  return <BodyScreen onBack={() => router.back()} />;
}
