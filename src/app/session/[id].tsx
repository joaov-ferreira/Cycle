import { useLocalSearchParams, useRouter } from 'expo-router';

import { SessionDetailScreen } from '@/components/periodization/session-detail-screen';

export default function SessionDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <SessionDetailScreen
      sessionId={id ?? ''}
      onBack={() => router.back()}
      onOpenSession={(sessionId) => router.push({ pathname: '/session/[id]', params: { id: sessionId } })}
    />
  );
}
