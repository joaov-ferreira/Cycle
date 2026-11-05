import { useRouter } from 'expo-router';

import { DashboardScreen } from '@/components/dashboard/dashboard-screen';

export default function DashboardRoute() {
  const router = useRouter();
  return (
    <DashboardScreen
      onOpenSession={(id) => router.push({ pathname: '/session/[id]', params: { id } })}
      onNavigate={(target) => router.navigate(`/${target}`)}
    />
  );
}
