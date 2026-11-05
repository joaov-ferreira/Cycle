import { useGlobalSearchParams, useRouter } from 'expo-router';

import { PeriodizationScreen } from '@/components/periodization/periodization-screen';

export default function PeriodizationRoute() {
  const router = useRouter();
  const { view } = useGlobalSearchParams<{ view?: string }>();
  return (
    <PeriodizationScreen
      view={view === 'calendar' ? 'calendar' : 'table'}
      onViewChange={(next) => router.setParams({ view: next })}
      onOpenProgram={(id) => router.push({ pathname: '/programs/[id]', params: { id } })}
      onOpenSession={(id) => router.push({ pathname: '/session/[id]', params: { id } })}
    />
  );
}
