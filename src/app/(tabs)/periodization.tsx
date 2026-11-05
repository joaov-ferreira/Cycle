import { useRouter } from 'expo-router';

import { PeriodizationScreen } from '@/components/periodization/periodization-screen';

export default function PeriodizationRoute() {
  const router = useRouter();
  return (
    <PeriodizationScreen
      onOpenProgram={(id) => router.push({ pathname: '/programs/[id]', params: { id } })}
    />
  );
}
